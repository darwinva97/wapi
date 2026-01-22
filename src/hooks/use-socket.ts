"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { getSocket } from "@/lib/socket-client";
import type { Socket } from "socket.io-client";

export interface SocketMessage {
  id: string;
  body: string | null;
  timestamp: Date | string;
  fromMe: boolean;
  senderId: string;
  messageType: "text" | "image" | "video" | "audio" | "sticker" | "document" | "location";
  mediaUrl?: string;
  mediaMetadata?: Record<string, unknown>;
  ackStatus: number;
  fileName?: string;
  isAckUpdate?: boolean;
}

export interface MessageUpdate {
  id: string;
  chatId?: string;
  ackStatus?: number;
  isAckUpdate?: boolean;
}

export interface WhatsappStatus {
  status: "open" | "close" | "connecting" | "session_error";
  whatsappId: string;
  message?: string;
  shouldReconnect?: boolean;
}

export interface UseSocketOptions {
  whatsappId: string;
  chatId?: string;
  onMessage?: (message: SocketMessage) => void;
  onMessageUpdate?: (update: MessageUpdate) => void;
  onStatus?: (status: WhatsappStatus) => void;
  onQr?: (qr: string) => void;
}

export interface UseSocketReturn {
  isConnected: boolean;
  joinChat: (chatId: string) => void;
  leaveChat: (chatId: string) => void;
}

export function useSocket(options: UseSocketOptions): UseSocketReturn {
  const { whatsappId, chatId, onMessage, onMessageUpdate, onStatus, onQr } = options;
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Store callbacks in refs to avoid re-subscribing on every render
  const onMessageRef = useRef(onMessage);
  const onMessageUpdateRef = useRef(onMessageUpdate);
  const onStatusRef = useRef(onStatus);
  const onQrRef = useRef(onQr);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onMessageUpdateRef.current = onMessageUpdate;
    onStatusRef.current = onStatus;
    onQrRef.current = onQr;
  }, [onMessage, onMessageUpdate, onStatus, onQr]);

  // Initialize socket and join rooms
  useEffect(() => {
    const socket = getSocket();
    socketRef.current = socket;

    // Connection status handlers
    const handleConnect = () => {
      setIsConnected(true);
      // Join whatsapp room on connect
      socket.emit("join:whatsapp", { whatsappId });
      // Join chat room if chatId provided
      if (chatId) {
        socket.emit("join:chat", { whatsappId, chatId });
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    // Message handlers
    const handleMessage = (message: SocketMessage) => {
      onMessageRef.current?.(message);
    };

    const handleMessageUpdate = (update: MessageUpdate) => {
      onMessageUpdateRef.current?.(update);
    };

    const handleStatus = (status: WhatsappStatus) => {
      onStatusRef.current?.(status);
    };

    const handleQr = (data: { qr: string; whatsappId: string }) => {
      if (data.whatsappId === whatsappId) {
        onQrRef.current?.(data.qr);
      }
    };

    // Set up listeners
    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("chat:message", handleMessage);
    socket.on("chat:message:update", handleMessageUpdate);
    socket.on("whatsapp:status", handleStatus);
    socket.on("whatsapp:qr", handleQr);

    // If already connected, join rooms immediately
    if (socket.connected) {
      handleConnect();
    }

    // Cleanup
    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("chat:message", handleMessage);
      socket.off("chat:message:update", handleMessageUpdate);
      socket.off("whatsapp:status", handleStatus);
      socket.off("whatsapp:qr", handleQr);

      // Leave rooms
      socket.emit("leave:whatsapp", { whatsappId });
      if (chatId) {
        socket.emit("leave:chat", { whatsappId, chatId });
      }
    };
  }, [whatsappId, chatId]);

  // Join a specific chat room
  const joinChat = useCallback((newChatId: string) => {
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit("join:chat", { whatsappId, chatId: newChatId });
    }
  }, [whatsappId]);

  // Leave a specific chat room
  const leaveChat = useCallback((oldChatId: string) => {
    const socket = socketRef.current;
    if (socket?.connected) {
      socket.emit("leave:chat", { whatsappId, chatId: oldChatId });
    }
  }, [whatsappId]);

  return {
    isConnected,
    joinChat,
    leaveChat,
  };
}
