/**
 * Maps Baileys events to JSON messages for the Elixir bridge.
 * Each event is serialized as a single JSON line to stdout.
 */

const CORRUPTION_INDICATORS = [
  "bad mac",
  "decryption failed",
  "invalid key",
  "session not found",
  "no session",
  "corrupt",
  "hmac",
];

function isSessionCorruptionError(error) {
  const msg = (error?.message || error?.toString() || "").toLowerCase();
  return CORRUPTION_INDICATORS.some((ind) => msg.includes(ind));
}

function mapDisconnectReason(lastDisconnect) {
  const statusCode = lastDisconnect?.error?.output?.statusCode;
  const error = lastDisconnect?.error;

  // Baileys DisconnectReason.loggedOut = 401
  if (statusCode === 401) return "logged_out";
  if (isSessionCorruptionError(error)) return "session_corrupted";
  return "unknown";
}

function sendEvent(whatsappId, event, data = {}) {
  const payload = JSON.stringify({
    whatsapp_id: whatsappId,
    event,
    ...data,
  });
  process.stdout.write(payload + "\n");
}

function sendResponse(requestId, success, data = {}) {
  const payload = JSON.stringify({
    response_id: requestId,
    success,
    ...data,
  });
  process.stdout.write(payload + "\n");
}

module.exports = {
  isSessionCorruptionError,
  mapDisconnectReason,
  sendEvent,
  sendResponse,
};
