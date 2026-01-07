import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WASocket,
  downloadContentFromMessage,
  proto,
} from "baileys";
import { db } from "@/db";
import { whatsappTable, connectionTable, contactTable, groupTable, messageTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import pino from "pino";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { EventEmitter } from "events";
import { normalizeContactData, isGroup, extractLidAndPn, isOwnContact, isOwnChat, extractMessageText } from "./whatsapp-utils";
import { downloadAndSaveMedia, MediaMetadata } from "./media";

// Track sessions that are currently connecting to prevent duplicate connections
const connectingLocks = new Set<string>();

// Helper to clear corrupted session (Bad MAC, decryption errors, etc.)
function clearCorruptedSession(whatsappId: string): void {
  const sessionPath = path.join(SESSIONS_DIR, whatsappId);
  if (fs.existsSync(sessionPath)) {
    console.log(`[Session] Clearing corrupted session for ${whatsappId}`);
    fs.rmSync(sessionPath, { recursive: true, force: true });
  }
  sessions.delete(whatsappId);
  qrs.delete(whatsappId);
  connectingLocks.delete(whatsappId);
}

// Check if error is a session/encryption error that requires session reset
function isSessionCorruptionError(error: any): boolean {
  const errorMessage = error?.message || error?.toString() || "";
  const corruptionIndicators = [
    "Bad MAC",
    "decryption failed",
    "invalid key",
    "session not found",
    "no session",
    "corrupt",
    "HMAC",
  ];
  return corruptionIndicators.some(indicator => 
    errorMessage.toLowerCase().includes(indicator.toLowerCase())
  );
}

export const whatsappEvents = (global as any).whatsappEvents || new EventEmitter();
if (process.env.NODE_ENV !== "production") {
  (global as any).whatsappEvents = whatsappEvents;
}

// Global map to store active connections
// In a production environment with multiple instances, this needs Redis or similar.
// For a single instance Next.js server, this global works (but beware of HMR in dev).
const globalForWhatsapp = global as unknown as { 
  whatsappSessions: Map<string, WASocket>,
  whatsappQrs: Map<string, string> 
};

const sessions = globalForWhatsapp.whatsappSessions || new Map<string, WASocket>();
const qrs = globalForWhatsapp.whatsappQrs || new Map<string, string>();

if (process.env.NODE_ENV !== "production") {
  globalForWhatsapp.whatsappSessions = sessions;
  globalForWhatsapp.whatsappQrs = qrs;
}

const SESSIONS_DIR = "whatsapp_sessions";

if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR);
}

// Acknowledgment status constants
const ACK_STATUS = {
  PENDING: 0,
  SENT: 1,
  DELIVERED: 2,
  READ: 3,
} as const;

// Helper to detect message type and extract metadata
function detectMessageType(message: proto.IMessage | null | undefined): {
  type: 'text' | 'image' | 'video' | 'audio' | 'sticker' | 'document';
  metadata: Partial<MediaMetadata>;
  messageContent: any;
} {
  if (!message) {
    return { type: 'text', metadata: {}, messageContent: null };
  }

  if (message.imageMessage) {
    return {
      type: 'image',
      metadata: {
        mimetype: message.imageMessage.mimetype || undefined,
        width: message.imageMessage.width || undefined,
        height: message.imageMessage.height || undefined,
        fileName: 'image.jpg',
      },
      messageContent: message.imageMessage,
    };
  }

  if (message.videoMessage) {
    return {
      type: 'video',
      metadata: {
        mimetype: message.videoMessage.mimetype || undefined,
        duration: message.videoMessage.seconds || undefined,
        width: message.videoMessage.width || undefined,
        height: message.videoMessage.height || undefined,
        fileName: 'video.mp4',
      },
      messageContent: message.videoMessage,
    };
  }

  if (message.audioMessage) {
    return {
      type: 'audio',
      metadata: {
        mimetype: message.audioMessage.mimetype || undefined,
        duration: message.audioMessage.seconds || undefined,
        fileName: 'audio.ogg',
      },
      messageContent: message.audioMessage,
    };
  }

  if (message.stickerMessage) {
    return {
      type: 'sticker',
      metadata: {
        mimetype: message.stickerMessage.mimetype || undefined,
        width: message.stickerMessage.width || undefined,
        height: message.stickerMessage.height || undefined,
        fileName: 'sticker.webp',
      },
      messageContent: message.stickerMessage,
    };
  }

  if (message.documentMessage) {
    return {
      type: 'document',
      metadata: {
        mimetype: message.documentMessage.mimetype || undefined,
        fileName: message.documentMessage.fileName || 'document',
      },
      messageContent: message.documentMessage,
    };
  }

  return { type: 'text', metadata: {}, messageContent: null };
}

// Helper to download media from message
async function downloadMediaFromMessage(messageContent: any, messageType: string): Promise<Buffer | null> {
  try {
    const stream = await downloadContentFromMessage(messageContent, messageType as any);
    
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    
    return Buffer.concat(chunks);
  } catch (error) {
    console.error("[Media] Error downloading media:", error);
    return null;
  }
}

export async function connectToWhatsApp(whatsappId: string) {
  // Prevent duplicate connections
  if (sessions.has(whatsappId)) {
    console.log(`[Session] Already connected: ${whatsappId}`);
    return sessions.get(whatsappId);
  }

  // Prevent concurrent connection attempts
  if (connectingLocks.has(whatsappId)) {
    console.log(`[Session] Connection already in progress for: ${whatsappId}`);
    return undefined;
  }

  connectingLocks.add(whatsappId);

  try {
    const sessionPath = path.join(SESSIONS_DIR, whatsappId);
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      logger: pino({ level: "silent" }) as any,
      printQRInTerminal: false,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }) as any),
      },
      generateHighQualityLinkPreview: true,
    });

    sessions.set(whatsappId, sock);
    connectingLocks.delete(whatsappId);

    // Global error handler for session corruption errors
    sock.ev.on("error" as any, (error: any) => {
      console.error(`[Session] Socket error for ${whatsappId}:`, error);
      if (isSessionCorruptionError(error)) {
        console.log(`[Session] Detected session corruption, clearing session...`);
        clearCorruptedSession(whatsappId);
        whatsappEvents.emit(`status-${whatsappId}`, { 
          status: 'session_error', 
          message: 'Session corrupted. Please reconnect and scan QR again.' 
        });
      }
    });

    sock.ev.on("creds.update", saveCreds);

  sock.ev.on("contacts.upsert", async (contacts) => {
    const user = sock.user;
    const phoneNumber = user?.id?.split(":")[0] || user?.id?.split("@")[0];

    for (const contact of contacts) {
      const normalized = normalizeContactData(contact);
      
      if (isOwnContact(normalized.lid, normalized.pn, phoneNumber || "")) continue;

      if (normalized.lid || normalized.pn) {
        // Check if exists
        let existing;
        
        if (normalized.lid) {
          existing = await db.query.contactTable.findFirst({
            where: and(
              eq(contactTable.whatsappId, whatsappId),
              eq(contactTable.lid, normalized.lid)
            )
          });
        } else if (normalized.pn) {
          existing = await db.query.contactTable.findFirst({
            where: and(
              eq(contactTable.whatsappId, whatsappId),
              eq(contactTable.pn, normalized.pn)
            )
          });
        }

        if (!existing) {
           // Insert
           const pushName = normalized.pn || normalized.notifyName || normalized.verifiedName || normalized.lid || 'Unknown';
           try {
             await db.insert(contactTable).values({
               id: crypto.randomUUID(),
               whatsappId,
               name: normalized.contactName || pushName, // Use pushName as fallback for name
               pushName,
               lid: normalized.lid || "", 
               pn: normalized.pn || "", 
               description: "",
             });
           } catch (e) {
             console.error("Error inserting contact:", e);
           }
        } else {
           // Update
           if (normalized.contactName) {
             try {
               await db.update(contactTable)
                 .set({ name: normalized.contactName })
                 .where(eq(contactTable.id, existing.id));
             } catch (e) {
               console.error("Error updating contact:", e);
             }
           }
        }
      }
    }
  });

  // Handle groups.upsert event - triggered when groups are added or updated
  sock.ev.on("groups.upsert", async (groups) => {
    console.log(`[groups.upsert] Received ${groups.length} groups for ${whatsappId}`);
    for (const group of groups) {
      try {
        const existing = await db.query.groupTable.findFirst({
          where: and(
            eq(groupTable.whatsappId, whatsappId),
            eq(groupTable.gid, group.id)
          )
        });

        if (!existing) {
          await db.insert(groupTable).values({
            id: crypto.randomUUID(),
            whatsappId,
            gid: group.id,
            name: group.subject || "Unknown Group",
            pushName: group.subject || "Unknown Group",
            description: group.desc || "",
          });
          console.log(`[groups.upsert] Inserted group: ${group.subject}`);
        } else {
          // Update existing group
          await db.update(groupTable)
            .set({
              name: group.subject || existing.name,
              pushName: group.subject || existing.pushName,
              description: group.desc || existing.description,
            })
            .where(eq(groupTable.id, existing.id));
          console.log(`[groups.upsert] Updated group: ${group.subject}`);
        }
      } catch (e) {
        console.error("[groups.upsert] Error processing group:", e);
      }
    }
  });

  // Handle groups.update event - triggered when group metadata changes
  sock.ev.on("groups.update", async (updates) => {
    console.log(`[groups.update] Received ${updates.length} group updates for ${whatsappId}`);
    for (const update of updates) {
      if (!update.id) continue;
      try {
        const existing = await db.query.groupTable.findFirst({
          where: and(
            eq(groupTable.whatsappId, whatsappId),
            eq(groupTable.gid, update.id)
          )
        });

        if (existing) {
          await db.update(groupTable)
            .set({
              name: update.subject || existing.name,
              description: update.desc || existing.description,
            })
            .where(eq(groupTable.id, existing.id));
          console.log(`[groups.update] Updated group: ${update.subject || update.id}`);
        }
      } catch (e) {
        console.error("[groups.update] Error updating group:", e);
      }
    }
  });

  sock.ev.on("chats.upsert", async (chats) => {
    const user = sock.user;
    const phoneNumber = user?.id?.split(":")[0] || user?.id?.split("@")[0];

    for (const chat of chats) {
      if (!chat.id || chat.id.includes("@broadcast")) continue;
      if (isOwnChat(chat.id, phoneNumber || "")) continue;

      if (isGroup(chat.id)) {
        // Group logic
        const existing = await db.query.groupTable.findFirst({
          where: and(
            eq(groupTable.whatsappId, whatsappId),
            eq(groupTable.gid, chat.id)
          )
        });

        if (!existing) {
           try {
             const metadata = await sock.groupMetadata(chat.id);
             await db.insert(groupTable).values({
               id: crypto.randomUUID(),
               whatsappId,
               gid: chat.id,
               name: metadata.subject || chat.name || "Unknown Group",
               pushName: metadata.subject || chat.name || "Unknown Group",
               description: metadata.desc || "",
             });
             console.log(`[chats.upsert] Inserted group: ${metadata.subject || chat.name}`);
           } catch (e) {
             console.error("Error fetching group metadata or inserting group:", e);
           }
        }
      } else {
        // Contact logic (update pushName if exists)
        const { lid, pn } = extractLidAndPn(chat.id);
        
        let existing;
        if (lid && !lid.includes("unknown")) {
          existing = await db.query.contactTable.findFirst({
            where: and(
              eq(contactTable.whatsappId, whatsappId),
              eq(contactTable.lid, lid)
            )
          });
        } else if (pn && !pn.includes("unknown")) {
          existing = await db.query.contactTable.findFirst({
            where: and(
              eq(contactTable.whatsappId, whatsappId),
              eq(contactTable.pn, pn)
            )
          });
        }

        if (existing && chat.name) {
          try {
            await db.update(contactTable)
              .set({ pushName: chat.name })
              .where(eq(contactTable.id, existing.id));
          } catch (e) {
            console.error("Error updating contact pushName:", e);
          }
        }
      }
    }
  });

  sock.ev.on("messages.upsert", async (m) => {
    // Save messages to DB
    try {
      for (const msg of m.messages) {
        if (!msg.key.remoteJid) continue;
        
        const body = extractMessageText(msg.message);
        const isGroupChat = isGroup(msg.key.remoteJid);

        const timestamp = typeof msg.messageTimestamp === 'number' 
          ? new Date(msg.messageTimestamp * 1000)
          : new Date((msg.messageTimestamp as any)?.toNumber?.() * 1000 || Date.now());

        // Detect message type and extract metadata
        const { type: messageType, metadata, messageContent } = detectMessageType(msg.message);
        
        let mediaUrl: string | null = null;
        let mediaMetadata: any = null;
        let fileName: string | null = null;
        
        // Download and save media if present
        if (messageType !== 'text' && messageContent) {
          try {
            console.log(`[Media] Downloading ${messageType} for message ${msg.key.id}`);
            
            const buffer = await downloadMediaFromMessage(messageContent, messageType);
            
            if (buffer) {
              // Use original filename from metadata, or generate one
              const sanitizedFilename = metadata.fileName || `${messageType}_${msg.key.id}`;
              fileName = metadata.fileName || null; // Store original filename separately
              
              const saveResult = await downloadAndSaveMedia(
                buffer,
                sanitizedFilename,
                whatsappId,
                msg.key.id || crypto.randomUUID(),
                metadata
              );
              
              mediaUrl = saveResult.url;
              mediaMetadata = saveResult.metadata;
              
              console.log(`[Media] Saved ${messageType} to ${mediaUrl}`);
            }
          } catch (mediaError) {
            console.error(`[Media] Failed to download ${messageType}:`, mediaError);
            // Store error in metadata but continue
            mediaMetadata = { ...metadata, error: 'Download failed' };
          }
        }

        // Determine initial ackStatus
        // fromMe messages start as sent (1), incoming messages are delivered (2)
        const ackStatus = msg.key.fromMe ? ACK_STATUS.SENT : ACK_STATUS.DELIVERED;

        await db.insert(messageTable).values({
          id: msg.key.id || crypto.randomUUID(),
          whatsappId,
          chatId: msg.key.remoteJid,
          chatType: isGroupChat ? 'group' : 'personal',
          senderId: msg.key.participant || msg.key.remoteJid,
          content: msg,
          body: body,
          timestamp: timestamp,
          fromMe: msg.key.fromMe || false,
          messageType,
          mediaUrl,
          mediaMetadata: mediaMetadata ? JSON.stringify(mediaMetadata) : null,
          ackStatus,
          fileName,
        }).onConflictDoNothing();

        // Emit event for real-time updates
        whatsappEvents.emit(`new-message-${msg.key.remoteJid}`, {
          id: msg.key.id,
          body,
          timestamp: timestamp,
          fromMe: msg.key.fromMe || false,
          senderId: msg.key.participant || msg.key.remoteJid,
          messageType,
          mediaUrl,
          mediaMetadata,
          ackStatus,
          fileName,
        });
      }
    } catch (e: any) {
      console.error("Error saving messages to DB:", e);
      
      // Check for session corruption errors
      if (isSessionCorruptionError(e)) {
        console.log(`[Session] Bad MAC error detected during message processing for ${whatsappId}`);
        clearCorruptedSession(whatsappId);
        whatsappEvents.emit(`status-${whatsappId}`, { 
          status: 'session_error', 
          message: 'Session corrupted during message processing. Please reconnect.' 
        });
        return;
      }
    }

    if (m.type !== "notify") return;

    try {
      const connections = await db.query.connectionTable.findMany({
        where: and(
          eq(connectionTable.whatsappId, whatsappId),
          eq(connectionTable.receiverEnabled, true)
        ),
      });
      console.log(connections);
      for (const connection of connections) {
        if (!connection.receiverRequest) continue;

        const config = connection.receiverRequest as { url: string; headers?: Record<string, string> };
        console.log(config);
        if (!config.url) continue;

        try {
          await fetch(config.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...config.headers,
            },
            body: JSON.stringify(m),
          });
        } catch (err) {
          console.error(`Error sending webhook for connection ${connection.slug}:`, err);
        }
      }
    } catch (err) {
      console.error("Error processing messages.upsert:", err);
    }
  });

  // Handle message status updates (ack: delivery receipts, read receipts)
  sock.ev.on("messages.update", async (updates) => {
    try {
      for (const update of updates) {
        const { key, update: statusUpdate } = update;
        
        if (!key.id || !key.remoteJid) continue;
        
        // Map Baileys status to our ackStatus
        // status: 0 = pending/error, 1 = server ack, 2 = delivered, 3 = read
        let newAckStatus: number | undefined;
        
        if (statusUpdate.status !== undefined) {
          // Direct status from Baileys
          if (statusUpdate.status === 0) newAckStatus = ACK_STATUS.PENDING;
          else if (statusUpdate.status === 1) newAckStatus = ACK_STATUS.SENT;
          else if (statusUpdate.status === 2) newAckStatus = ACK_STATUS.DELIVERED;
          else if (statusUpdate.status === 3) newAckStatus = ACK_STATUS.READ;
        }
        
        // Check for read receipt (handle different possible property names)
        if (statusUpdate.readTimestamp || (statusUpdate as { read?: unknown }).read) {
          newAckStatus = ACK_STATUS.READ;
        }
        
        if (newAckStatus !== undefined) {
          console.log(`[Ack] Updating message ${key.id} to status ${newAckStatus}`);
          
          // Update database
          await db.update(messageTable)
            .set({ ackStatus: newAckStatus })
            .where(
              and(
                eq(messageTable.id, key.id),
                eq(messageTable.whatsappId, whatsappId)
              )
            );
          
          // Emit SSE event for real-time update
          whatsappEvents.emit(`message-ack-${key.id}`, {
            messageId: key.id,
            chatId: key.remoteJid,
            ackStatus: newAckStatus,
          });
          
          // Also emit to chat channel for UI updates
          whatsappEvents.emit(`new-message-${key.remoteJid}`, {
            id: key.id,
            ackStatus: newAckStatus,
            isAckUpdate: true,
          });
        }
      }
    } catch (error) {
      console.error("[Ack] Error updating message status:", error);
    }
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log(`QR Code for ${whatsappId}:`, qr);
      qrs.set(whatsappId, qr);
      whatsappEvents.emit(`qr-${whatsappId}`, qr);
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const errorMessage = lastDisconnect?.error?.message || "";
      const isLoggedOut = statusCode === DisconnectReason.loggedOut;
      const isSessionCorrupted = isSessionCorruptionError(lastDisconnect?.error);
      
      console.log(`Connection closed for ${whatsappId}. Status: ${statusCode}, Error: ${errorMessage}`);

      // Update DB
      try {
        await db.update(whatsappTable)
          .set({ connected: false })
          .where(eq(whatsappTable.id, whatsappId));
      } catch (e) {
        console.error("Error updating DB on close:", e);
      }

      sessions.delete(whatsappId);
      qrs.delete(whatsappId);
      connectingLocks.delete(whatsappId);

      // Handle session corruption (Bad MAC, decryption errors)
      if (isSessionCorrupted) {
        console.log(`[Session] Session corruption detected for ${whatsappId}, clearing session...`);
        clearCorruptedSession(whatsappId);
        whatsappEvents.emit(`status-${whatsappId}`, { 
          status: 'session_error', 
          message: 'Session corrupted (Bad MAC). Please scan QR code again.',
          shouldReconnect: true 
        });
        // Reconnect after clearing - will require new QR scan
        setTimeout(() => connectToWhatsApp(whatsappId), 2000);
        return;
      }

      whatsappEvents.emit(`status-${whatsappId}`, { status: 'close', shouldReconnect: !isLoggedOut });

      if (!isLoggedOut) {
        // Reconnect with exponential backoff
        setTimeout(() => connectToWhatsApp(whatsappId), 3000);
      } else {
        // Logged out - clear session
        clearCorruptedSession(whatsappId);
      }
    } else if (connection === "open") {
      console.log(`Connection opened for ${whatsappId}`);
      qrs.delete(whatsappId);
      whatsappEvents.emit(`status-${whatsappId}`, { status: 'open' });

      // Update DB
      try {
        await db.update(whatsappTable)
          .set({ connected: true })
          .where(eq(whatsappTable.id, whatsappId));
      } catch (e) {
        console.error("Error updating DB on open:", e);
      }

      // Sync groups on connection open
      try {
        console.log(`[connection.open] Syncing groups for ${whatsappId}...`);
        const participatingGroups = await sock.groupFetchAllParticipating();
        const groupIds = Object.keys(participatingGroups);
        console.log(`[connection.open] Found ${groupIds.length} groups`);

        for (const gid of groupIds) {
          const group = participatingGroups[gid];
          const existing = await db.query.groupTable.findFirst({
            where: and(
              eq(groupTable.whatsappId, whatsappId),
              eq(groupTable.gid, gid)
            )
          });

          if (!existing) {
            await db.insert(groupTable).values({
              id: crypto.randomUUID(),
              whatsappId,
              gid: gid,
              name: group.subject || "Unknown Group",
              pushName: group.subject || "Unknown Group",
              description: group.desc || "",
            });
            console.log(`[connection.open] Inserted group: ${group.subject}`);
          } else {
            // Update existing group
            await db.update(groupTable)
              .set({
                name: group.subject || existing.name,
                pushName: group.subject || existing.pushName,
                description: group.desc || existing.description,
              })
              .where(eq(groupTable.id, existing.id));
          }
        }
        console.log(`[connection.open] Group sync completed for ${whatsappId}`);
      } catch (e) {
        console.error("[connection.open] Error syncing groups:", e);
      }
    } else if (connection === "connecting") {
      whatsappEvents.emit(`status-${whatsappId}`, { status: 'connecting' });
    }
  });

  return sock;
  } catch (error: any) {
    console.error(`[Session] Error connecting WhatsApp ${whatsappId}:`, error);
    connectingLocks.delete(whatsappId);
    
    // If it's a session corruption error, clear and allow retry
    if (isSessionCorruptionError(error)) {
      clearCorruptedSession(whatsappId);
      whatsappEvents.emit(`status-${whatsappId}`, { 
        status: 'session_error', 
        message: 'Session corrupted during connection. Please try again.' 
      });
    }
    
    throw error;
  }
}

export async function disconnectWhatsApp(whatsappId: string) {
  const sock = sessions.get(whatsappId);
  if (sock) {
    try {
      sock.end(undefined);
    } catch (e) {
      console.error("Error ending socket:", e);
    }
    sessions.delete(whatsappId);
    qrs.delete(whatsappId);
    connectingLocks.delete(whatsappId);

    try {
      await db.update(whatsappTable)
        .set({ connected: false })
        .where(eq(whatsappTable.id, whatsappId));
    } catch (e) {
      console.error("Error updating DB on disconnect:", e);
    }
  }
}

// Force reset a session (clears all session data and requires new QR scan)
export async function forceResetSession(whatsappId: string) {
  console.log(`[Session] Force resetting session for ${whatsappId}`);
  
  // Disconnect if connected
  await disconnectWhatsApp(whatsappId);
  
  // Clear the session files
  clearCorruptedSession(whatsappId);
  
  // Update DB
  try {
    await db.update(whatsappTable)
      .set({ connected: false })
      .where(eq(whatsappTable.id, whatsappId));
  } catch (e) {
    console.error("Error updating DB on force reset:", e);
  }
  
  console.log(`[Session] Session reset complete for ${whatsappId}`);
}

export function getSocket(whatsappId: string) {
  return sessions.get(whatsappId);
}

export function getQr(whatsappId: string) {
  return qrs.get(whatsappId);
}

// Check if a session is currently connecting
export function isConnecting(whatsappId: string) {
  return connectingLocks.has(whatsappId);
}
