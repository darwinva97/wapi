import { Socket, Channel } from "phoenix";
import { ELIXIR_API_URL, ELIXIR_WS_URL } from "@/config/elixir";

export { ELIXIR_API_URL };

let socket: Socket | null = null;
const channels: Map<string, Channel> = new Map();

function getAuthToken(): string | null {
  if (typeof document === "undefined") return null;
  // better-auth stores the session token in a cookie
  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === "better-auth.session_token") {
      return decodeURIComponent(value);
    }
  }
  return null;
}

export function getSocket(): Socket {
  if (socket) return socket;

  const token = getAuthToken();
  if (!token) {
    throw new Error("No auth token found");
  }

  socket = new Socket(ELIXIR_WS_URL, {
    params: { token },
  });

  socket.connect();
  return socket;
}

export function getChannel(
  topic: string,
  params: Record<string, unknown> = {}
): Channel {
  const existing = channels.get(topic);
  if (existing && existing.state !== "closed" && existing.state !== "errored") {
    return existing;
  }

  const sock = getSocket();
  const channel = sock.channel(topic, params);
  channels.set(topic, channel);
  return channel;
}

export function leaveChannel(topic: string) {
  const channel = channels.get(topic);
  if (channel) {
    channel.leave();
    channels.delete(topic);
  }
}

export function disconnectSocket() {
  channels.forEach((channel) => channel.leave());
  channels.clear();
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export async function elixirFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = getAuthToken();
  return fetch(`${ELIXIR_API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}
