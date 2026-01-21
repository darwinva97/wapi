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
import {
  whatsappTable,
  connectionTable,
  contactTable,
  groupTable,
  messageTable,
  reactionTable,
  pollTable,
  pollVoteTable,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import pino from "pino";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { EventEmitter } from "events";
import {
  normalizeContactData,
  isGroup,
  extractLidAndPn,
  isOwnContact,
  isOwnChat,
  extractMessageText,
  get_Receiver_and_Sender_and_Context_FromMessage,
} from "./whatsapp-utils";
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
function isSessionCorruptionError(error: unknown): boolean {
  const errorMessage = (error as Error)?.message || error?.toString() || "";
  const corruptionIndicators = [
    "Bad MAC",
    "decryption failed",
    "invalid key",
    "session not found",
    "no session",
    "corrupt",
    "HMAC",
  ];
  return corruptionIndicators.some((indicator) =>
    errorMessage.toLowerCase().includes(indicator.toLowerCase()),
  );
}

// Global map to store active connections
// In a production environment with multiple instances, this needs Redis or similar.
// For a single instance Next.js server, this global works (but beware of HMR in dev).
const globalForWhatsapp = global as unknown as {
  whatsappSessions: Map<string, WASocket>;
  whatsappQrs: Map<string, string>;
  whatsappEvents: EventEmitter;
};

if (!globalForWhatsapp.whatsappEvents) {
  globalForWhatsapp.whatsappEvents = new EventEmitter();
  globalForWhatsapp.whatsappEvents.setMaxListeners(100);
}

export const whatsappEvents = globalForWhatsapp.whatsappEvents;

const sessions =
  globalForWhatsapp.whatsappSessions || new Map<string, WASocket>();
const qrs = globalForWhatsapp.whatsappQrs || new Map<string, string>();

if (!globalForWhatsapp.whatsappSessions) {
  globalForWhatsapp.whatsappSessions = sessions;
}
if (!globalForWhatsapp.whatsappQrs) {
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
  type:
    | "text"
    | "image"
    | "video"
    | "audio"
    | "sticker"
    | "document"
    | "location";
  metadata: Partial<MediaMetadata>;
  messageContent: proto.IMessage[keyof proto.IMessage] | null;
} {
  if (!message) {
    return { type: "text", metadata: {}, messageContent: null };
  }

  if (message.imageMessage) {
    return {
      type: "image",
      metadata: {
        mimetype: message.imageMessage.mimetype || undefined,
        width: message.imageMessage.width || undefined,
        height: message.imageMessage.height || undefined,
        fileName: "image.jpg",
      },
      messageContent: message.imageMessage,
    };
  }

  if (message.videoMessage) {
    return {
      type: "video",
      metadata: {
        mimetype: message.videoMessage.mimetype || undefined,
        duration: message.videoMessage.seconds || undefined,
        width: message.videoMessage.width || undefined,
        height: message.videoMessage.height || undefined,
        fileName: "video.mp4",
      },
      messageContent: message.videoMessage,
    };
  }

  if (message.audioMessage) {
    return {
      type: "audio",
      metadata: {
        mimetype: message.audioMessage.mimetype || undefined,
        duration: message.audioMessage.seconds || undefined,
        fileName: "audio.ogg",
      },
      messageContent: message.audioMessage,
    };
  }

  if (message.stickerMessage) {
    return {
      type: "sticker",
      metadata: {
        mimetype: message.stickerMessage.mimetype || undefined,
        width: message.stickerMessage.width || undefined,
        height: message.stickerMessage.height || undefined,
        fileName: "sticker.webp",
      },
      messageContent: message.stickerMessage,
    };
  }

  if (message.documentMessage) {
    return {
      type: "document",
      metadata: {
        mimetype: message.documentMessage.mimetype || undefined,
        fileName: message.documentMessage.fileName || "document",
      },
      messageContent: message.documentMessage,
    };
  }

  if (message.locationMessage) {
    return {
      type: "location",
      metadata: {
        latitude: message.locationMessage.degreesLatitude ?? undefined,
        longitude: message.locationMessage.degreesLongitude ?? undefined,
        locationName: message.locationMessage.name ?? undefined,
        locationAddress: message.locationMessage.address ?? undefined,
      },
      messageContent: message.locationMessage,
    };
  }

  return { type: "text", metadata: {}, messageContent: null };
}

// Helper to download media from message
async function downloadMediaFromMessage(
  messageContent: proto.IMessage[keyof proto.IMessage],
  messageType: string,
): Promise<Buffer | null> {
  try {
    const stream = await downloadContentFromMessage(
      messageContent as never,
      messageType as never,
    );

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
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(
          state.keys,
          pino({ level: "silent" }),
        ),
      },
      generateHighQualityLinkPreview: true,
    });

    sessions.set(whatsappId, sock);
    connectingLocks.delete(whatsappId);

    // Global error handler for session corruption errors
    sock.ev.on("error" as never, (error: unknown) => {
      console.log(`[Event] error triggered for ${whatsappId}`);
      console.error(`[Session] Socket error for ${whatsappId}:`, error);
      if (isSessionCorruptionError(error)) {
        console.log(
          `[Session] Detected session corruption, clearing session...`,
        );
        clearCorruptedSession(whatsappId);
        whatsappEvents.emit(`status-${whatsappId}`, {
          status: "session_error",
          message: "Session corrupted. Please reconnect and scan QR again.",
        });
      }
    });

    sock.ev.on("creds.update", () => {
      console.log(`[Event] creds.update triggered for ${whatsappId}`);
      saveCreds();
    });

    sock.ev.on("contacts.upsert", async (contacts) => {
      console.log(
        `[Event] contacts.upsert triggered for ${whatsappId} - ${contacts.length} contacts`,
      );
      const user = sock.user;
      const phoneNumber = user?.id?.split(":")[0] || user?.id?.split("@")[0];

      for (const contact of contacts) {
        const normalized = normalizeContactData(contact);

        if (isOwnContact(normalized.lid, normalized.pn, phoneNumber || ""))
          continue;

        if (normalized.lid || normalized.pn) {
          // Check if exists
          let existing;

          if (normalized.lid) {
            existing = await db.query.contactTable.findFirst({
              where: and(
                eq(contactTable.whatsappId, whatsappId),
                eq(contactTable.lid, normalized.lid),
              ),
            });
          } else if (normalized.pn) {
            existing = await db.query.contactTable.findFirst({
              where: and(
                eq(contactTable.whatsappId, whatsappId),
                eq(contactTable.pn, normalized.pn),
              ),
            });
          }

          if (!existing) {
            // Insert
            const pushName =
              normalized.pn ||
              normalized.notifyName ||
              normalized.verifiedName ||
              normalized.lid ||
              "Unknown";
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
                await db
                  .update(contactTable)
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
      console.log(
        `[Event] groups.upsert triggered for ${whatsappId} - ${groups.length} groups`,
      );
      console.log(
        `[groups.upsert] Received ${groups.length} groups for ${whatsappId}`,
      );
      for (const group of groups) {
        try {
          const existing = await db.query.groupTable.findFirst({
            where: and(
              eq(groupTable.whatsappId, whatsappId),
              eq(groupTable.gid, group.id),
            ),
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
            await db
              .update(groupTable)
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
      console.log(
        `[Event] groups.update triggered for ${whatsappId} - ${updates.length} updates`,
      );
      console.log(
        `[groups.update] Received ${updates.length} group updates for ${whatsappId}`,
      );
      for (const update of updates) {
        if (!update.id) continue;
        try {
          const existing = await db.query.groupTable.findFirst({
            where: and(
              eq(groupTable.whatsappId, whatsappId),
              eq(groupTable.gid, update.id),
            ),
          });

          if (existing) {
            await db
              .update(groupTable)
              .set({
                name: update.subject || existing.name,
                description: update.desc || existing.description,
              })
              .where(eq(groupTable.id, existing.id));
            console.log(
              `[groups.update] Updated group: ${update.subject || update.id}`,
            );
          }
        } catch (e) {
          console.error("[groups.update] Error updating group:", e);
        }
      }
    });

    sock.ev.on("chats.upsert", async (chats) => {
      console.log(
        `[Event] chats.upsert triggered for ${whatsappId} - ${chats.length} chats`,
      );
      const user = sock.user;
      const phoneNumber = user?.id?.split(":")[0] || user?.id?.split("@")[0];

      for (const chat of chats) {
        console.log(chat);

        if (!chat.id || chat.id.includes("@broadcast")) continue;
        if (isOwnChat(chat.id, phoneNumber || "")) continue;

        if (isGroup(chat.id)) {
          // Group logic
          const existing = await db.query.groupTable.findFirst({
            where: and(
              eq(groupTable.whatsappId, whatsappId),
              eq(groupTable.gid, chat.id),
            ),
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
              console.log(
                `[chats.upsert] Inserted group: ${metadata.subject || chat.name}`,
              );
            } catch (e) {
              console.error(
                "Error fetching group metadata or inserting group:",
                e,
              );
            }
          }
        } else {
          // Contact logic (update pushName if exists)
          const { lid, pn } = extractLidAndPn(chat.id);

          // Validate lid and pn formats
          const validLid = lid && lid.includes("@lid") ? lid : null;
          const validPn = pn && pn.includes("@s.whatsapp.net") ? pn : null;

          let existing;
          if (validLid) {
            existing = await db.query.contactTable.findFirst({
              where: and(
                eq(contactTable.whatsappId, whatsappId),
                eq(contactTable.lid, validLid),
              ),
            });
          } else if (validPn) {
            existing = await db.query.contactTable.findFirst({
              where: and(
                eq(contactTable.whatsappId, whatsappId),
                eq(contactTable.pn, validPn),
              ),
            });
          }

          if (existing && chat.name) {
            try {
              await db
                .update(contactTable)
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
      console.log(
        `[Event] messages.upsert triggered for ${whatsappId} - ${m.messages.length} messages - type: ${m.type}`,
      );
      // Save messages to DB
      try {
        for (const msg of m.messages) {
          //
          const result = get_Receiver_and_Sender_and_Context_FromMessage(
            msg as unknown as Parameters<
              typeof get_Receiver_and_Sender_and_Context_FromMessage
            >[0],
          );
          if (!result) continue;

          const { messageId, messageTimestamp, receiver, sender, context } =
            result;

          //
          if (!msg.key.remoteJid) continue;
          console.log(msg);

          // Calculate timestamp and senderId first (needed for reactions and polls)
          const timestamp =
            typeof messageTimestamp === "number"
              ? new Date(messageTimestamp * 1000)
              : new Date(
                  ((
                    messageTimestamp as { toNumber?: () => number }
                  )?.toNumber?.() || 0) * 1000 || Date.now(),
                );

          const senderId = msg.key.participant || msg.key.remoteJid;

          // Skip non-message actions (reactions, polls, etc.)
          if (msg.message?.reactionMessage) {
            console.log(
              `[messages.upsert] Processing reaction from ${senderId}`,
            );

            try {
              const reaction = msg.message.reactionMessage;
              const targetMessageId = reaction.key?.id;

              if (targetMessageId) {
                // Check if this is removing a reaction (empty emoji)
                if (!reaction.text || reaction.text === "") {
                  // Delete the reaction
                  await db
                    .delete(reactionTable)
                    .where(
                      and(
                        eq(reactionTable.whatsappId, whatsappId),
                        eq(reactionTable.messageId, targetMessageId),
                        eq(reactionTable.senderId, senderId),
                      ),
                    );
                  console.log(
                    `[reactions] Removed reaction from message ${targetMessageId}`,
                  );
                } else {
                  // Add or update reaction
                  await db
                    .insert(reactionTable)
                    .values({
                      id: msg.key.id || crypto.randomUUID(),
                      whatsappId,
                      messageId: targetMessageId,
                      chatId: msg.key.remoteJid,
                      senderId: senderId,
                      emoji: reaction.text,
                      timestamp: timestamp,
                      fromMe: msg.key.fromMe || false,
                    })
                    .onConflictDoUpdate({
                      target: reactionTable.id,
                      set: {
                        emoji: reaction.text,
                        timestamp: timestamp,
                      },
                    });
                  console.log(
                    `[reactions] Saved reaction ${reaction.text} to message ${targetMessageId}`,
                  );
                }
              }
            } catch (e) {
              console.error("[reactions] Error processing reaction:", e);
            }

            continue;
          }

          if (msg.message?.pollUpdateMessage) {
            console.log(
              `[messages.upsert] Processing poll vote from ${senderId}`,
            );

            try {
              const pollUpdate = msg.message.pollUpdateMessage;
              const pollMessageId = pollUpdate.pollCreationMessageKey?.id;

              if (pollMessageId && pollUpdate.vote) {
                // Find the poll
                const poll = await db.query.pollTable.findFirst({
                  where: and(
                    eq(pollTable.whatsappId, whatsappId),
                    eq(pollTable.messageId, pollMessageId),
                  ),
                });

                if (poll) {
                  // Extract selected options - handle encrypted vote data
                  const selectedOptions =
                    (pollUpdate.vote as { selectedOptions?: number[] })
                      ?.selectedOptions || [];

                  // Save the vote
                  await db
                    .insert(pollVoteTable)
                    .values({
                      id: msg.key.id || crypto.randomUUID(),
                      whatsappId,
                      pollId: poll.id,
                      voterId: senderId,
                      selectedOptions: selectedOptions,
                      timestamp: timestamp,
                    })
                    .onConflictDoUpdate({
                      target: pollVoteTable.id,
                      set: {
                        selectedOptions: selectedOptions,
                        timestamp: timestamp,
                      },
                    });
                  console.log(`[polls] Saved vote for poll ${pollMessageId}`);
                }
              }
            } catch (e) {
              console.error("[polls] Error processing poll vote:", e);
            }

            continue;
          }

          if (msg.message?.pollCreationMessage) {
            console.log(
              `[messages.upsert] Poll creation detected - will be saved as message`,
            );
            // The poll message will be saved as a regular message below,
            // but we also create a poll entry for tracking votes
          }

          const body = extractMessageText(msg.message);
          const isGroupChat = isGroup(msg.key.remoteJid);

          // Check and create contact if sender doesn't exist and it's not own message
          if (
            !msg.key.fromMe &&
            senderId &&
            !senderId.includes("@g.us") &&
            !senderId.includes("@broadcast")
          ) {
            const user = sock.user;
            const ownPhoneNumber =
              user?.id?.split(":")[0] || user?.id?.split("@")[0];

            // Extract lid and pn using remoteJid and remoteJidAlt for better accuracy
            const { lid, pn } = extractLidAndPn(
              msg.key.remoteJid,
              (msg.key as { remoteJidAlt?: string }).remoteJidAlt
            );

            // Determine correct lid and pn values (only valid ones)
            const validLid: string | null =
              lid && lid.includes("@lid") ? lid : null;
            const validPn: string | null =
              pn && pn.includes("@s.whatsapp.net") ? pn : null;

            // Skip if it's own contact
            if (!isOwnContact(validLid, validPn, ownPhoneNumber || "")) {
              // Check if contact exists by lid or pn
              let existingContact;

              if (validLid) {
                existingContact = await db.query.contactTable.findFirst({
                  where: and(
                    eq(contactTable.whatsappId, whatsappId),
                    eq(contactTable.lid, validLid),
                  ),
                });
              }

              if (!existingContact && validPn) {
                existingContact = await db.query.contactTable.findFirst({
                  where: and(
                    eq(contactTable.whatsappId, whatsappId),
                    eq(contactTable.pn, validPn),
                  ),
                });
              }

              if (existingContact) {
                // Update contact if we have better information
                const shouldUpdate =
                  (validLid &&
                    existingContact.lid !== validLid &&
                    (!existingContact.lid ||
                      !existingContact.lid.includes("@lid"))) ||
                  (validPn &&
                    existingContact.pn !== validPn &&
                    (!existingContact.pn ||
                      !existingContact.pn.includes("@s.whatsapp.net")));

                if (shouldUpdate) {
                  try {
                    const updateData: Partial<{ lid: string; pn: string }> = {};
                    if (
                      validLid &&
                      (!existingContact.lid ||
                        !existingContact.lid.includes("@lid"))
                    ) {
                      updateData.lid = validLid;
                    }
                    if (
                      validPn &&
                      (!existingContact.pn ||
                        !existingContact.pn.includes("@s.whatsapp.net"))
                    ) {
                      updateData.pn = validPn;
                    }

                    if (Object.keys(updateData).length > 0) {
                      await db
                        .update(contactTable)
                        .set(updateData)
                        .where(eq(contactTable.id, existingContact.id));
                      console.log(
                        `[messages.upsert] Updated contact with correct values: ${existingContact.name} - lid: ${updateData.lid || "unchanged"}, pn: ${updateData.pn || "unchanged"}`,
                      );
                    }
                  } catch (e) {
                    console.error(
                      `[messages.upsert] Error updating contact:`,
                      e,
                    );
                  }
                }
              } else {
                // Create new contact only if we have valid lid or pn
                if (validLid || validPn) {
                  try {
                    const pushName =
                      (msg as { pushName?: string }).pushName ||
                      validPn?.split("@")[0] ||
                      validLid?.split("@")[0] ||
                      "Unknown";

                    await db.insert(contactTable).values({
                      id: crypto.randomUUID(),
                      whatsappId,
                      name: pushName,
                      pushName: pushName,
                      lid: validLid || "",
                      pn: validPn || "",
                      description: "",
                    });

                    console.log(
                      `[messages.upsert] Created new contact from message: ${pushName} - lid: ${validLid || "empty"}, pn: ${validPn || "empty"}`,
                    );
                  } catch (e) {
                    console.error(
                      `[messages.upsert] Error creating contact for sender ${senderId}:`,
                      e,
                    );
                  }
                }
              }
            }
          }

          // Detect message type and extract metadata
          const {
            type: messageType,
            metadata,
            messageContent,
          } = detectMessageType(msg.message);

          let mediaUrl: string | null = null;
          let mediaMetadata: Partial<MediaMetadata> | null = null;
          let fileName: string | null = null;

          // Handle location messages (no media to download, just metadata)
          if (messageType === "location") {
            mediaMetadata = metadata;
            console.log(
              `[Location] Received location: ${metadata.latitude}, ${metadata.longitude}`,
            );
          }
          // Download and save media if present (for image, video, audio, sticker, document)
          else if (messageType !== "text" && messageContent) {
            try {
              console.log(
                `[Media] Downloading ${messageType} for message ${msg.key.id}`,
              );

              const buffer = await downloadMediaFromMessage(
                messageContent,
                messageType,
              );

              if (buffer) {
                // Use original filename from metadata, or generate one
                const sanitizedFilename =
                  metadata.fileName || `${messageType}_${msg.key.id}`;
                fileName = metadata.fileName || null; // Store original filename separately

                const saveResult = await downloadAndSaveMedia(
                  buffer,
                  sanitizedFilename,
                  whatsappId,
                  msg.key.id || crypto.randomUUID(),
                  metadata,
                );

                mediaUrl = saveResult.url;
                mediaMetadata = saveResult.metadata;

                console.log(`[Media] Saved ${messageType} to ${mediaUrl}`);
              }
            } catch (mediaError) {
              console.error(
                `[Media] Failed to download ${messageType}:`,
                mediaError,
              );
              // Continue without media on error
              mediaMetadata = metadata;
            }
          }

          // Determine initial ackStatus
          // fromMe messages start as sent (1), incoming messages are delivered (2)
          const ackStatus = msg.key.fromMe
            ? ACK_STATUS.SENT
            : ACK_STATUS.DELIVERED;

          await db
            .insert(messageTable)
            .values({
              id: msg.key.id || crypto.randomUUID(),
              whatsappId,
              chatId: msg.key.remoteJid,
              chatType: isGroupChat ? "group" : "personal",
              senderId: senderId,
              content: msg,
              body: body,
              timestamp: timestamp,
              fromMe: msg.key.fromMe || false,
              messageType,
              mediaUrl,
              mediaMetadata: mediaMetadata
                ? JSON.stringify(mediaMetadata)
                : null,
              ackStatus,
              fileName,
            })
            .onConflictDoNothing();

          // If this is a poll creation, also save poll data
          if (msg.message?.pollCreationMessage) {
            try {
              const pollMsg = msg.message.pollCreationMessage;
              await db
                .insert(pollTable)
                .values({
                  id: crypto.randomUUID(),
                  whatsappId,
                  messageId: msg.key.id || crypto.randomUUID(),
                  chatId: msg.key.remoteJid,
                  question: pollMsg.name || "Poll",
                  options: pollMsg.options?.map((opt) => opt.optionName) || [],
                  allowMultipleAnswers: pollMsg.selectableOptionsCount
                    ? pollMsg.selectableOptionsCount > 1
                    : false,
                  createdBy: msg.key.participant || msg.key.remoteJid,
                  timestamp: timestamp,
                })
                .onConflictDoNothing();
              console.log(`[polls] Saved poll data for message ${msg.key.id}`);
            } catch (e) {
              console.error("[polls] Error saving poll data:", e);
            }
          }

          // Emit event for real-time updates
          whatsappEvents.emit(`new-message-${msg.key.remoteJid}`, {
            id: msg.key.id,
            body,
            timestamp: timestamp,
            fromMe: msg.key.fromMe || false,
            senderId: senderId,
            messageType,
            mediaUrl,
            mediaMetadata,
            ackStatus,
            fileName,
          });
        }
      } catch (e: unknown) {
        console.error("Error saving messages to DB:", e);

        // Check for session corruption errors
        if (isSessionCorruptionError(e)) {
          console.log(
            `[Session] Bad MAC error detected during message processing for ${whatsappId}`,
          );
          clearCorruptedSession(whatsappId);
          whatsappEvents.emit(`status-${whatsappId}`, {
            status: "session_error",
            message:
              "Session corrupted during message processing. Please reconnect.",
          });
          return;
        }
      }

      if (m.type !== "notify") return;

      try {
        const connections = await db.query.connectionTable.findMany({
          where: and(
            eq(connectionTable.whatsappId, whatsappId),
            eq(connectionTable.receiverEnabled, true),
          ),
        });
        console.log(connections);
        for (const connection of connections) {
          if (!connection.receiverRequest) continue;

          const config = connection.receiverRequest as {
            url: string;
            headers?: Record<string, string>;
          };
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
            console.error(
              `Error sending webhook for connection ${connection.slug}:`,
              err,
            );
          }
        }
      } catch (err) {
        console.error("Error processing messages.upsert:", err);
      }
    });

    // Handle message status updates (ack: delivery receipts, read receipts)
    sock.ev.on("messages.update", async (updates) => {
      console.log(
        `[Event] messages.update triggered for ${whatsappId} - ${updates.length} updates`,
      );
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
            else if (statusUpdate.status === 2)
              newAckStatus = ACK_STATUS.DELIVERED;
            else if (statusUpdate.status === 3) newAckStatus = ACK_STATUS.READ;
          }

          // Check for read receipt (handle different possible property names)
          if (
            (statusUpdate as { readTimestamp?: unknown }).readTimestamp ||
            (statusUpdate as { read?: unknown }).read
          ) {
            newAckStatus = ACK_STATUS.READ;
          }

          if (newAckStatus !== undefined) {
            console.log(
              `[Ack] Updating message ${key.id} to status ${newAckStatus}`,
            );

            // Update database
            await db
              .update(messageTable)
              .set({ ackStatus: newAckStatus })
              .where(
                and(
                  eq(messageTable.id, key.id),
                  eq(messageTable.whatsappId, whatsappId),
                ),
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
      console.log(
        `[Event] connection.update triggered for ${whatsappId} - status: ${update.connection}`,
      );
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log(`QR Code for ${whatsappId}:`, qr);
        qrs.set(whatsappId, qr);
        whatsappEvents.emit(`qr-${whatsappId}`, qr);
      }

      if (connection === "close") {
        const statusCode = (
          lastDisconnect?.error as { output?: { statusCode?: number } }
        )?.output?.statusCode;
        const errorMessage = lastDisconnect?.error?.message || "";
        const isLoggedOut = statusCode === DisconnectReason.loggedOut;
        const isSessionCorrupted = isSessionCorruptionError(
          lastDisconnect?.error,
        );

        console.log(
          `Connection closed for ${whatsappId}. Status: ${statusCode}, Error: ${errorMessage}`,
        );

        // Update DB
        try {
          await db
            .update(whatsappTable)
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
          console.log(
            `[Session] Session corruption detected for ${whatsappId}, clearing session...`,
          );
          clearCorruptedSession(whatsappId);
          whatsappEvents.emit(`status-${whatsappId}`, {
            status: "session_error",
            message: "Session corrupted (Bad MAC). Please scan QR code again.",
            shouldReconnect: true,
          });
          // Reconnect after clearing - will require new QR scan
          setTimeout(() => connectToWhatsApp(whatsappId), 2000);
          return;
        }

        whatsappEvents.emit(`status-${whatsappId}`, {
          status: "close",
          shouldReconnect: !isLoggedOut,
        });

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
        whatsappEvents.emit(`status-${whatsappId}`, { status: "open" });

        // Update DB
        try {
          await db
            .update(whatsappTable)
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
                eq(groupTable.gid, gid),
              ),
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
              await db
                .update(groupTable)
                .set({
                  name: group.subject || existing.name,
                  pushName: group.subject || existing.pushName,
                  description: group.desc || existing.description,
                })
                .where(eq(groupTable.id, existing.id));
            }
          }
          console.log(
            `[connection.open] Group sync completed for ${whatsappId}`,
          );
        } catch (e) {
          console.error("[connection.open] Error syncing groups:", e);
        }
      } else if (connection === "connecting") {
        whatsappEvents.emit(`status-${whatsappId}`, { status: "connecting" });
      }
    });

    return sock;
  } catch (error: unknown) {
    console.error(`[Session] Error connecting WhatsApp ${whatsappId}:`, error);
    connectingLocks.delete(whatsappId);

    // If it's a session corruption error, clear and allow retry
    if (isSessionCorruptionError(error)) {
      clearCorruptedSession(whatsappId);
      whatsappEvents.emit(`status-${whatsappId}`, {
        status: "session_error",
        message: "Session corrupted during connection. Please try again.",
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
  }

  // Always update DB, even if socket wasn't in memory
  try {
    await db
      .update(whatsappTable)
      .set({ connected: false })
      .where(eq(whatsappTable.id, whatsappId));
  } catch (e) {
    console.error("Error updating DB on disconnect:", e);
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
    await db
      .update(whatsappTable)
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

// Check real connection state and sync with DB
export async function syncConnectionState(whatsappId: string): Promise<{
  isConnected: boolean;
  wasOutOfSync: boolean;
}> {
  const sock = sessions.get(whatsappId);

  // Check real connection state
  // A socket exists and user is defined means it's truly connected
  const isReallyConnected = !!(sock && sock.user);

  // Get DB state
  const dbRecord = await db.query.whatsappTable.findFirst({
    where: eq(whatsappTable.id, whatsappId),
    columns: { connected: true },
  });

  const dbConnected = dbRecord?.connected ?? false;
  const wasOutOfSync = dbConnected !== isReallyConnected;

  // Sync if out of sync
  if (wasOutOfSync) {
    console.log(
      `[Sync] State mismatch for ${whatsappId}: DB=${dbConnected}, Real=${isReallyConnected}. Syncing...`,
    );
    try {
      await db
        .update(whatsappTable)
        .set({ connected: isReallyConnected })
        .where(eq(whatsappTable.id, whatsappId));
    } catch (e) {
      console.error("Error syncing connection state:", e);
    }
  }

  return { isConnected: isReallyConnected, wasOutOfSync };
}

// Sync all WhatsApp connections state with DB
export async function syncAllConnectionStates(): Promise<void> {
  console.log("[Sync] Starting sync of all connection states...");

  try {
    const allWhatsapps = await db.query.whatsappTable.findMany({
      columns: { id: true, connected: true },
    });

    for (const wa of allWhatsapps) {
      await syncConnectionState(wa.id);
    }

    console.log(`[Sync] Completed sync for ${allWhatsapps.length} accounts`);
  } catch (e) {
    console.error("[Sync] Error syncing all connection states:", e);
  }
}

// Periodic sync interval (runs every 30 seconds)
let syncInterval: ReturnType<typeof setInterval> | null = null;

export function startPeriodicSync(intervalMs: number = 30000): void {
  if (syncInterval) {
    console.log("[Sync] Periodic sync already running");
    return;
  }

  console.log(`[Sync] Starting periodic sync every ${intervalMs}ms`);
  syncInterval = setInterval(() => {
    syncAllConnectionStates().catch(console.error);
  }, intervalMs);
}

export function stopPeriodicSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log("[Sync] Periodic sync stopped");
  }
}
