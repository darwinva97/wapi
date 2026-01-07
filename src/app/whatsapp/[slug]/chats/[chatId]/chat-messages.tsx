'use client';

import { useEffect, useRef, useState, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  body: string | null;
  timestamp: Date;
  fromMe: boolean;
  senderId: string;
  messageType?: string;
  mediaUrl?: string | null;
  mediaMetadata?: Record<string, unknown>;
  ackStatus?: number;
  fileName?: string | null;
  isAckUpdate?: boolean;
}

interface ChatMessagesProps {
  initialMessages: Message[];
  chatId: string;
}

export function ChatMessages({ initialMessages, chatId }: ChatMessagesProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const initialMessageIds = useMemo(() => initialMessages.map(m => m.id).join(','), [initialMessages]);

  // Sync state with initialMessages only when message IDs actually change
  useEffect(() => {
    setMessages(prev => {
      // Merge: keep SSE messages that aren't in initialMessages yet, add new ones from initialMessages
      const existingIds = new Set(prev.map(m => m.id));
      const newFromServer = initialMessages.filter(m => !existingIds.has(m.id));
      
      if (newFromServer.length === 0 && prev.length >= initialMessages.length) {
        // No new messages from server, keep current state (preserves SSE messages)
        return prev;
      }
      
      // Merge all unique messages and sort by timestamp
      const allIds = new Set<string>();
      const merged = [...prev, ...initialMessages].filter(m => {
        if (allIds.has(m.id)) return false;
        allIds.add(m.id);
        return true;
      });
      
      return merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    });
  }, [initialMessageIds, initialMessages]);

  useEffect(() => {
    // Scroll to bottom on initial load
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, []);

  useEffect(() => {
    // Scroll to bottom when messages change
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    console.log("Connecting to SSE for chat:", chatId);
    const eventSource = new EventSource(`/api/sse/chat/${encodeURIComponent(chatId)}`);

    eventSource.onopen = () => {
      console.log("SSE Connected");
    };

    eventSource.onmessage = (event) => {
      console.log("SSE Message received:", event.data);
      try {
        const newMessage = JSON.parse(event.data);
        // Convert timestamp string back to Date object
        if (newMessage.timestamp) {
          newMessage.timestamp = new Date(newMessage.timestamp);
        }
        
        setMessages((prev) => {
          // Handle ack updates
          if (newMessage.isAckUpdate) {
            return prev.map(m => 
              m.id === newMessage.id 
                ? { ...m, ackStatus: newMessage.ackStatus }
                : m
            );
          }
          
          // Avoid duplicates for new messages
          if (prev.some(m => m.id === newMessage.id)) return prev;
          return [...prev, newMessage];
        });
      } catch (e) {
        console.error("Error parsing SSE message:", e);
      }
    };

    eventSource.onerror = (err) => {
      console.error("SSE Error:", err);
      eventSource.close();
    };

    return () => {
      console.log("Closing SSE connection");
      eventSource.close();
    };
  }, [chatId]);

  return (
    <ScrollArea className="flex-1 min-h-0 overflow-auto p-4" ref={scrollRef}>
      <div className="flex flex-col gap-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">
            No hay mensajes aún.
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex w-max max-w-[75%] flex-col gap-2 rounded-lg px-3 py-2 text-sm",
                msg.fromMe
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-muted"
              )}
            >
              {/* Media Preview */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {msg.messageType === 'image' && msg.mediaUrl && (
                <img 
                  src={msg.mediaUrl} 
                  alt={msg.fileName ? `Imagen: ${msg.fileName}` : 'Imagen de WhatsApp'} 
                  className="rounded max-w-full h-auto max-h-64 object-contain"
                />
              )}
              {msg.messageType === 'video' && msg.mediaUrl && (
                <video 
                  src={msg.mediaUrl} 
                  controls 
                  className="rounded max-w-full h-auto max-h-64"
                  aria-label={msg.fileName ? `Video: ${msg.fileName}` : 'Video de WhatsApp'}
                />
              )}
              {msg.messageType === 'audio' && msg.mediaUrl && (
                <audio 
                  src={msg.mediaUrl} 
                  controls 
                  className="w-full"
                  aria-label={msg.fileName ? `Audio: ${msg.fileName}` : 'Audio de WhatsApp'}
                />
              )}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {msg.messageType === 'sticker' && msg.mediaUrl && (
                <img 
                  src={msg.mediaUrl} 
                  alt="Sticker de WhatsApp" 
                  className="rounded max-w-32 h-auto"
                />
              )}
              {msg.messageType === 'document' && msg.mediaUrl && (
                <a 
                  href={msg.mediaUrl} 
                  download={msg.fileName || 'document'}
                  className="flex items-center gap-2 text-blue-500 hover:underline"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>{msg.fileName || 'Descargar Documento'}</span>
                </a>
              )}
              
              {/* Text Body */}
              {msg.body || (msg.messageType !== 'text' && !msg.mediaUrl && <span className="italic opacity-50">Media/Mensaje del sistema</span>)}
              
              {/* Timestamp and Delivery Status */}
              <div className="flex items-center gap-1 text-[10px] opacity-70 self-end">
                <span suppressHydrationWarning>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.fromMe && (
                  <span className="ml-1">
                    {msg.ackStatus === 0 && '⏱'} {/* pending */}
                    {msg.ackStatus === 1 && '✓'} {/* sent */}
                    {msg.ackStatus === 2 && '✓✓'} {/* delivered */}
                    {msg.ackStatus === 3 && <span className="text-blue-400">✓✓</span>} {/* read */}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
