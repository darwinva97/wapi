import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WASocket,
} from "baileys";
import pino from "pino";
import fs from "fs";
import path from "path";
import { get_Receiver_and_Sender_and_Context_FromMessage } from "../lib/whatsapp-utils";
import type {
  YoEscriboAContacto,
  ContactoMeEscribe,
  YoEscriboAGrupo,
  GrupoMeEscribe,
} from "../lib/whatsapp-types";

const SESSIONS_DIR = "whatsapp_sessions";

async function main() {
  // Find the first available session
  const sessionDirs = fs.readdirSync(SESSIONS_DIR).filter((dir) => {
    const fullPath = path.join(SESSIONS_DIR, dir);
    return fs.statSync(fullPath).isDirectory();
  });

  if (sessionDirs.length === 0) {
    console.error("No sessions found in", SESSIONS_DIR);
    process.exit(1);
  }

  const whatsappId = sessionDirs[0];
  console.log(`Using session: ${whatsappId}`);

  const sessionPath = path.join(SESSIONS_DIR, whatsappId);
  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  const logger = pino({ level: "warn" });

  const sock: WASocket = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    printQRInTerminal: false,
    logger,
  });

  sock.ev.on("creds.update", saveCreds);

  // Listen for incoming messages and parse them with get_Receiver_and_Sender_and_Context_FromMessage
  sock.ev.on("messages.upsert", async (m) => {
    for (const msg of m.messages) {
      // Skip broadcast messages
      if (msg.broadcast) continue;

      const result = get_Receiver_and_Sender_and_Context_FromMessage(
        msg as unknown as {
          key: YoEscriboAContacto | ContactoMeEscribe | YoEscriboAGrupo | GrupoMeEscribe;
          pushName: string;
          broadcast: boolean;
          messageTimestamp: number;
        }
      );

      if (!result) {
        console.log("[SKIP] Could not parse message:", msg.key);
        continue;
      }

      const { messageId, messageTimestamp, receiver, sender, context } = result;

      console.log("\n========== NEW MESSAGE ==========");
      console.log("Message ID (for DB):", messageId);
      console.log("Timestamp:", new Date(messageTimestamp * 1000).toISOString());
      console.log("Context:", JSON.stringify(context, null, 2));
      console.log("Sender:", JSON.stringify(sender, null, 2));
      console.log("Receiver:", JSON.stringify(receiver, null, 2));
      console.log("Body:", msg.message?.conversation || msg.message?.extendedTextMessage?.text || "[media/other]");
      console.log("=================================\n");
    }
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log("Connected successfully!");
      console.log("User:", sock.user);

      // Send a test message
      // Replace with your test JID (phone number)
      const testJid = "REPLACE_WITH_JID@s.whatsapp.net"; // e.g., "5491112345678@s.whatsapp.net"
      const testMessage = "Test message from test-socket script";

      if (testJid.startsWith("REPLACE")) {
        console.log("\n--- Socket ready for sending messages ---");
        console.log("To send a message, modify testJid variable with a valid JID");
        console.log("Example: 5491112345678@s.whatsapp.net");
        console.log("\nListening for incoming messages...");
        console.log("Press Ctrl+C to exit\n");
        return;
      }

      try {
        console.log(`\nSending message to ${testJid}...`);
        const sentResult = await sock.sendMessage(testJid, { text: testMessage });

        if (sentResult) {
          // Parse the sent message with our function
          const parsedSent = get_Receiver_and_Sender_and_Context_FromMessage({
            key: sentResult.key as YoEscriboAContacto | ContactoMeEscribe | YoEscriboAGrupo | GrupoMeEscribe,
            pushName: sock.user?.name || "",
            broadcast: false,
            messageTimestamp: Math.floor(Date.now() / 1000),
          });

          console.log("\n========== SENT MESSAGE ==========");
          console.log("Message ID (for DB):", parsedSent?.messageId);
          console.log("Context:", JSON.stringify(parsedSent?.context, null, 2));
          console.log("Sender:", JSON.stringify(parsedSent?.sender, null, 2));
          console.log("Receiver:", JSON.stringify(parsedSent?.receiver, null, 2));
          console.log("==================================\n");
        }
      } catch (error) {
        console.error("Error sending message:", error);
      }
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      console.log("Connection closed. Status code:", statusCode);
      process.exit(0);
    }
  });

  // Keep the process running
  process.on("SIGINT", () => {
    console.log("\nClosing connection...");
    sock.end(undefined);
    process.exit(0);
  });
}

main().catch(console.error);
