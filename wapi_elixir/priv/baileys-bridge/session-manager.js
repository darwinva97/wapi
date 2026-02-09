/**
 * Manages Baileys WhatsApp sessions.
 * Each session runs in the same Node.js process but is tracked independently.
 */

const makeWASocket = require("baileys").default;
const {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  DisconnectReason,
  downloadContentFromMessage,
} = require("baileys");
const pino = require("pino");
const path = require("path");
const fs = require("fs");
const {
  sendEvent,
  sendResponse,
  mapDisconnectReason,
  isSessionCorruptionError,
} = require("./event-mapper");

const SESSIONS_DIR = "whatsapp_sessions";
const sessions = new Map();

if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

async function connectSession(whatsappId) {
  if (sessions.has(whatsappId)) {
    console.error(`[Bridge] Session ${whatsappId} already exists`);
    return;
  }

  try {
    const sessionPath = path.join(SESSIONS_DIR, whatsappId);
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
          pino({ level: "silent" })
        ),
      },
      generateHighQualityLinkPreview: true,
    });

    sessions.set(whatsappId, sock);

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        sendEvent(whatsappId, "qr", { qr });
      }

      if (connection === "close") {
        const reason = mapDisconnectReason(lastDisconnect);
        sessions.delete(whatsappId);
        sendEvent(whatsappId, "connection.close", { reason });

        // Clear session if corrupted
        if (reason === "session_corrupted") {
          const sessionPath = path.join(SESSIONS_DIR, whatsappId);
          if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
          }
        }
      } else if (connection === "open") {
        sendEvent(whatsappId, "connection.open", {
          user: sock.user,
        });
      } else if (connection === "connecting") {
        sendEvent(whatsappId, "connection.connecting", {});
      }
    });

    sock.ev.on("messages.upsert", (m) => {
      sendEvent(whatsappId, "messages.upsert", {
        messages: m.messages,
        type: m.type,
      });
    });

    sock.ev.on("messages.update", (updates) => {
      sendEvent(whatsappId, "messages.update", { updates });
    });

    sock.ev.on("contacts.upsert", (contacts) => {
      sendEvent(whatsappId, "contacts.upsert", { contacts });
    });

    sock.ev.on("groups.upsert", (groups) => {
      sendEvent(whatsappId, "groups.upsert", { groups });
    });

    sock.ev.on("groups.update", (updates) => {
      sendEvent(whatsappId, "groups.update", { updates });
    });

    sock.ev.on("messaging-history.set", ({ contacts, messages }) => {
      if (contacts && contacts.length > 0) {
        sendEvent(whatsappId, "contacts.upsert", { contacts });
      }
    });

    sock.ev.on("chats.upsert", (chats) => {
      sendEvent(whatsappId, "chats.upsert", { chats });
    });
  } catch (error) {
    console.error(`[Bridge] Error connecting ${whatsappId}:`, error.message);
    sessions.delete(whatsappId);

    if (isSessionCorruptionError(error)) {
      const sessionPath = path.join(SESSIONS_DIR, whatsappId);
      if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
      }
      sendEvent(whatsappId, "connection.close", {
        reason: "session_corrupted",
      });
    }
  }
}

function disconnectSession(whatsappId) {
  const sock = sessions.get(whatsappId);
  if (sock) {
    try {
      sock.end(undefined);
    } catch (e) {
      console.error(`[Bridge] Error disconnecting ${whatsappId}:`, e.message);
    }
    sessions.delete(whatsappId);
  }
}

async function sendMessage(whatsappId, jid, message, requestId) {
  const sock = sessions.get(whatsappId);
  if (!sock) {
    sendResponse(requestId, false, {
      error: "Session not connected",
    });
    return;
  }

  try {
    const result = await sock.sendMessage(jid, message);
    sendResponse(requestId, true, { data: result });
  } catch (error) {
    sendResponse(requestId, false, { error: error.message });
  }
}

async function downloadMedia(whatsappId, messageContent, messageType, requestId) {
  try {
    const stream = await downloadContentFromMessage(messageContent, messageType);
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    sendResponse(requestId, true, {
      data: { buffer: buffer.toString("base64") },
    });
  } catch (error) {
    sendResponse(requestId, false, { error: error.message });
  }
}

module.exports = {
  connectSession,
  disconnectSession,
  sendMessage,
  downloadMedia,
  sessions,
};
