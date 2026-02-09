#!/usr/bin/env node

/**
 * WAPI Baileys Bridge - Node.js sidecar for Elixir/OTP backend.
 *
 * Communicates with Elixir via stdin (commands) and stdout (events/responses).
 * Each line is a JSON-encoded message.
 */

const readline = require("readline");
const {
  connectSession,
  disconnectSession,
  sendMessage,
  downloadMedia,
} = require("./session-manager");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

// Redirect console.error to stderr (stdout is reserved for protocol)
const originalLog = console.log;
console.log = (...args) => {
  process.stderr.write(args.join(" ") + "\n");
};

process.stderr.write("[Bridge] Baileys bridge started\n");

rl.on("line", async (line) => {
  try {
    const cmd = JSON.parse(line.trim());

    switch (cmd.action) {
      case "connect":
        await connectSession(cmd.whatsapp_id);
        break;

      case "disconnect":
        disconnectSession(cmd.whatsapp_id);
        break;

      case "send_message":
        await sendMessage(
          cmd.whatsapp_id,
          cmd.jid,
          cmd.message,
          cmd.request_id
        );
        break;

      case "download_media":
        await downloadMedia(
          cmd.whatsapp_id,
          cmd.message_content,
          cmd.message_type,
          cmd.request_id
        );
        break;

      default:
        process.stderr.write(`[Bridge] Unknown action: ${cmd.action}\n`);
    }
  } catch (error) {
    process.stderr.write(`[Bridge] Error processing command: ${error.message}\n`);
  }
});

rl.on("close", () => {
  process.stderr.write("[Bridge] stdin closed, exiting\n");
  process.exit(0);
});

// Handle uncaught errors
process.on("uncaughtException", (error) => {
  process.stderr.write(`[Bridge] Uncaught exception: ${error.message}\n`);
  process.stderr.write(error.stack + "\n");
});

process.on("unhandledRejection", (reason) => {
  process.stderr.write(`[Bridge] Unhandled rejection: ${reason}\n`);
});
