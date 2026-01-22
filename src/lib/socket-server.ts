import { Server as SocketIOServer, Socket } from "socket.io";
import { whatsappEvents } from "./whatsapp";

// Global reference to the Socket.IO server
const globalForSocket = global as unknown as {
  socketIO: SocketIOServer | null;
};

if (!globalForSocket.socketIO) {
  globalForSocket.socketIO = null;
}

// Get the global Socket.IO server instance
export function getIO(): SocketIOServer | null {
  return globalForSocket.socketIO;
}

// Initialize Socket.IO server and set up event handlers
export function initializeSocketServer(io: SocketIOServer): void {
  globalForSocket.socketIO = io;

  // Connection handler
  io.on("connection", (socket: Socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Join whatsapp room - for status, QR, contacts, groups
    socket.on("join:whatsapp", ({ whatsappId }: { whatsappId: string }) => {
      const room = `whatsapp:${whatsappId}`;
      socket.join(room);
      console.log(`[Socket.IO] ${socket.id} joined room: ${room}`);
    });

    // Leave whatsapp room
    socket.on("leave:whatsapp", ({ whatsappId }: { whatsappId: string }) => {
      const room = `whatsapp:${whatsappId}`;
      socket.leave(room);
      console.log(`[Socket.IO] ${socket.id} left room: ${room}`);
    });

    // Join chat room - for messages
    socket.on("join:chat", ({ whatsappId, chatId }: { whatsappId: string; chatId: string }) => {
      const room = `chat:${whatsappId}:${chatId}`;
      socket.join(room);
      console.log(`[Socket.IO] ${socket.id} joined room: ${room}`);
    });

    // Leave chat room
    socket.on("leave:chat", ({ whatsappId, chatId }: { whatsappId: string; chatId: string }) => {
      const room = `chat:${whatsappId}:${chatId}`;
      socket.leave(room);
      console.log(`[Socket.IO] ${socket.id} left room: ${room}`);
    });

    // Disconnect handler
    socket.on("disconnect", (reason) => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id} - ${reason}`);
    });
  });

  // Bridge EventEmitter events to Socket.IO
  setupEventBridge(io);

  console.log("[Socket.IO] Server initialized with event bridge");
}

// Bridge existing EventEmitter events to Socket.IO rooms
function setupEventBridge(io: SocketIOServer): void {
  // Store active listeners to avoid duplicates on HMR
  const activeListeners = new Map<string, (...args: unknown[]) => void>();

  // Helper to create a bridged listener
  const createBridgedListener = (
    eventPattern: RegExp,
    extractInfo: (eventName: string) => { room: string; eventType: string } | null
  ) => {
    return (eventName: string, listener: (...args: unknown[]) => void) => {
      if (!eventPattern.test(eventName)) return;

      const info = extractInfo(eventName);
      if (!info) return;

      // Remove old listener if exists (for HMR)
      const existingListener = activeListeners.get(eventName);
      if (existingListener) {
        whatsappEvents.off(eventName, existingListener);
      }

      // Create new bridged listener
      const bridgedListener = (...args: unknown[]) => {
        // Call original listener
        listener(...args);
        // Emit to Socket.IO room
        io.to(info.room).emit(info.eventType, ...args);
      };

      activeListeners.set(eventName, bridgedListener);
      whatsappEvents.on(eventName, bridgedListener);
    };
  };

  // Override EventEmitter's emit to also emit to Socket.IO
  const originalEmit = whatsappEvents.emit.bind(whatsappEvents);
  whatsappEvents.emit = (eventName: string | symbol, ...args: unknown[]): boolean => {
    const result = originalEmit(eventName, ...args);

    if (typeof eventName !== "string") return result;

    // Bridge new-message events to chat rooms
    const newMessageMatch = eventName.match(/^new-message-(.+)$/);
    if (newMessageMatch) {
      const chatId = newMessageMatch[1];
      // Find all whatsappIds that have this chat open
      // For now, emit to all rooms matching the pattern
      const rooms = Array.from(io.sockets.adapter.rooms.keys());
      for (const room of rooms) {
        if (room.includes(`:${chatId}`)) {
          io.to(room).emit("chat:message", args[0]);
        }
      }
    }

    // Bridge QR events
    const qrMatch = eventName.match(/^qr-(.+)$/);
    if (qrMatch) {
      const whatsappId = qrMatch[1];
      io.to(`whatsapp:${whatsappId}`).emit("whatsapp:qr", { qr: args[0], whatsappId });
    }

    // Bridge status events
    const statusMatch = eventName.match(/^status-(.+)$/);
    if (statusMatch) {
      const whatsappId = statusMatch[1];
      io.to(`whatsapp:${whatsappId}`).emit("whatsapp:status", { ...args[0] as object, whatsappId });
    }

    // Bridge message ack events
    const ackMatch = eventName.match(/^message-ack-(.+)$/);
    if (ackMatch) {
      const data = args[0] as { chatId?: string };
      if (data?.chatId) {
        const rooms = Array.from(io.sockets.adapter.rooms.keys());
        for (const room of rooms) {
          if (room.includes(`:${data.chatId}`)) {
            io.to(room).emit("chat:message:update", args[0]);
          }
        }
      }
    }

    return result;
  };
}

// Helper to emit events to specific rooms from anywhere in the app
export function emitToWhatsappRoom(whatsappId: string, event: string, data: unknown): void {
  const io = getIO();
  if (io) {
    io.to(`whatsapp:${whatsappId}`).emit(event, data);
  }
}

export function emitToChatRoom(whatsappId: string, chatId: string, event: string, data: unknown): void {
  const io = getIO();
  if (io) {
    io.to(`chat:${whatsappId}:${chatId}`).emit(event, data);
  }
}
