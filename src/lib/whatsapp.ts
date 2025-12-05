import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WASocket,
} from "baileys";
import { db } from "@/db";
import { whatsappTable, connectionTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import pino from "pino";
import fs from "fs";
import path from "path";
import { EventEmitter } from "events";

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
