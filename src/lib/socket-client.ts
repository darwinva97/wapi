"use client";

import { io, Socket } from "socket.io-client";

// Socket.IO client singleton
let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({
      // Connect to same origin
      path: "/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socket.on("connect", () => {
      console.log("[Socket.IO] Connected:", socket?.id);
    });

    socket.on("disconnect", (reason) => {
      console.log("[Socket.IO] Disconnected:", reason);
    });

    socket.on("connect_error", (error) => {
      console.error("[Socket.IO] Connection error:", error.message);
    });
  }

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
