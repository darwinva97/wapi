'use client';

import { useEffect, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import Image from "next/image";

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

  // Sync state with initialMessages when they change (e.g. after revalidatePath)
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

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
    <ScrollArea className="flex-1 p-4" ref={scrollRef}>
      <div className="flex flex-col gap-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">
            No messages yet.
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
              {msg.messageType === 'image' && msg.mediaUrl && (
                <Image
                  src={msg.mediaUrl} 
                  alt={msg.fileName ? `Image: ${msg.fileName}` : 'WhatsApp image'} 
                  className="rounded max-w-full h-auto max-h-64 object-contain"
                  width={400}
                  height={400}
                />
              )}
              {msg.messageType === 'video' && msg.mediaUrl && (
                <video 
                  src={msg.mediaUrl} 
                  controls 
                  className="rounded max-w-full h-auto max-h-64"
                  aria-label={msg.fileName ? `Video: ${msg.fileName}` : 'WhatsApp video'}
                />
              )}
              {msg.messageType === 'audio' && msg.mediaUrl && (
                <audio 
                  src={msg.mediaUrl} 
                  controls 
                  className="w-full"
                  aria-label={msg.fileName ? `Audio: ${msg.fileName}` : 'WhatsApp audio'}
                />
              )}
              {msg.messageType === 'sticker' && msg.mediaUrl && (
                <Image 
                  src={msg.mediaUrl} 
                  alt="WhatsApp sticker" 
                  className="rounded max-w-32 h-auto"
                  width={128}
                  height={128}
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
                  <span>{msg.fileName || 'Download Document'}</span>
                </a>
              )}
              
              {/* Text Body */}
              {msg.body || (msg.messageType !== 'text' && !msg.mediaUrl && <span className="italic opacity-50">Media/System Message</span>)}
              
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
