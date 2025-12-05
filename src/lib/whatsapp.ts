import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WASocket,
} from "baileys";
import { db } from "@/db";
import { whatsappTable, connectionTable, contactTable, groupTable } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";
import pino from "pino";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { EventEmitter } from "events";
import { normalizeContactData, getBestContactName, isGroup, extractLidAndPn, isOwnContact, isOwnChat } from "./whatsapp-utils";

export const whatsappEvents = new EventEmitter();

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

export async function connectToWhatsApp(whatsappId: string) {
  if (sessions.has(whatsappId)) {
    return sessions.get(whatsappId);
  }

  const sessionPath = path.join(SESSIONS_DIR, whatsappId);
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: "silent" }) as any,
    printQRInTerminal: false, // Deprecated and causes warnings
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }) as any),
    },
    generateHighQualityLinkPreview: true,
  });

  sessions.set(whatsappId, sock);

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
    if (m.type !== "notify") return;

    try {
      const connections = await db.query.connectionTable.findMany({
        where: and(
          eq(connectionTable.whatsappId, whatsappId),
          eq(connectionTable.receiverEnabled, true)
        ),
      });

      for (const connection of connections) {
        if (!connection.receiverRequest) continue;

        const config = connection.receiverRequest as { url: string; headers?: Record<string, string> };
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

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log(`QR Code for ${whatsappId}:`, qr);
      qrs.set(whatsappId, qr);
      whatsappEvents.emit(`qr-${whatsappId}`, qr);
    }

    if (connection === "close") {
      const shouldReconnect = (lastDisconnect?.error as any)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log(`Connection closed for ${whatsappId}. Reconnecting: ${shouldReconnect}`);

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
      whatsappEvents.emit(`status-${whatsappId}`, { status: 'close', shouldReconnect });

      if (shouldReconnect) {
        connectToWhatsApp(whatsappId);
      } else {
        // Logged out
        if (fs.existsSync(sessionPath)) {
          fs.rmSync(sessionPath, { recursive: true, force: true });
        }
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
    } else if (connection === "connecting") {
      whatsappEvents.emit(`status-${whatsappId}`, { status: 'connecting' });
    }
  });

  return sock;
}

export async function disconnectWhatsApp(whatsappId: string) {
  const sock = sessions.get(whatsappId);
  if (sock) {
    sock.end(undefined);
    sessions.delete(whatsappId);
    qrs.delete(whatsappId);

    try {
      await db.update(whatsappTable)
        .set({ connected: false })
        .where(eq(whatsappTable.id, whatsappId));
    } catch (e) {
      console.error("Error updating DB on disconnect:", e);
    }
  }
}

export function getSocket(whatsappId: string) {
  return sessions.get(whatsappId);
}

export function getQr(whatsappId: string) {
  return qrs.get(whatsappId);
}
