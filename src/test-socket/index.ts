import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  WASocket,
} from "baileys";
import pino from "pino";
import fs from "fs";
import path from "path";

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
        console.log("\nPress Ctrl+C to exit");
        return;
      }

      try {
        console.log(`\nSending message to ${testJid}...`);
        const result = await sock.sendMessage(testJid, { text: testMessage });
        console.log("Message sent successfully!");
        console.log("Result:", JSON.stringify(result, null, 2));
      } catch (error) {
        console.error("Error sending message:", error);
      }

      // Keep the connection open or close it
      // sock.end(undefined);
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
