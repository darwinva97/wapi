'use client';

import { useEffect, useRef, useState, useTransition, Fragment } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { AudioPlayer } from "./audio-player";
import { VideoPlayer } from "./video-player";
import { SmilePlus } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { sendReactionAction } from "./chat-actions";

interface Reaction {
  id: string;
  emoji: string;
  senderId: string;
  fromMe: boolean;
}

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
  reactions?: Reaction[];
}

interface ChatMessagesProps {
  initialMessages: Message[];
  chatId: string;
  slug: string;
  senderNames?: Record<string, string>;
  isGroup?: boolean;
}

// URL regex pattern
const URL_REGEX = /(https?:\/\/[^\s<>"{}|\\^`[\]]+)/gi;

// Common reaction emojis
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// Function to render text with clickable links
function renderTextWithLinks(text: string, fromMe: boolean) {
  const parts = text.split(URL_REGEX);

  return parts.map((part, index) => {
    if (URL_REGEX.test(part)) {
      // Reset regex lastIndex
      URL_REGEX.lastIndex = 0;
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "underline break-all",
            fromMe ? "text-primary-foreground/90 hover:text-primary-foreground" : "text-blue-600 hover:text-blue-800"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export function ChatMessages({ initialMessages, chatId, slug, senderNames = {}, isGroup = false }: ChatMessagesProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPending, startTransition] = useTransition();
  const [openReactionId, setOpenReactionId] = useState<string | null>(null);

  const handleReaction = (messageId: string, emoji: string) => {
    setOpenReactionId(null);
    startTransition(async () => {
      try {
        await sendReactionAction(slug, chatId, messageId, emoji);
      } catch (error) {
        console.error('Error sending reaction:', error);
      }
    });
  };
  const bottomRef = useRef<HTMLDivElement>(null);

  // Sync state with initialMessages when they change
  useEffect(() => {
    // Merge: keep SSE messages that aren't in initialMessages yet, add new ones from initialMessages
    const allIds = new Set<string>();
    const merged = [...messages, ...initialMessages].filter(m => {
      if (allIds.has(m.id)) return false;
      allIds.add(m.id);
      return true;
    });
    
    const sorted = merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    
    // Only update if there are actually new messages
    if (sorted.length !== messages.length) {
      setMessages(sorted);
    }
  }, [initialMessages]); // Only depend on initialMessages, not messages

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
    <ScrollArea className="flex-1 min-h-0 overflow-auto" ref={scrollRef}>
      <div className="flex flex-col gap-4 p-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-10">
            No hay mensajes aún.
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "group relative w-fit max-w-[85%] md:max-w-[75%] flex-col gap-2 rounded-lg px-3 py-2 text-sm break-words [overflow-wrap:anywhere]",
                msg.fromMe
                  ? "ml-auto bg-primary text-primary-foreground"
                  : "bg-muted"
              )}
            >
              {/* Sender Name for Group Messages */}
              {isGroup && !msg.fromMe && (
                <div className="text-xs font-semibold opacity-80 mb-1">
                  {senderNames[msg.senderId] || msg.senderId}
                </div>
              )}
              {/* Media Preview */}
              {msg.messageType === 'image' && msg.mediaUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={msg.mediaUrl}
                  alt={msg.fileName ? `Imagen: ${msg.fileName}` : 'Imagen de WhatsApp'}
                  className="rounded max-w-full h-auto max-h-64 object-contain cursor-pointer"
                  onClick={() => window.open(msg.mediaUrl!, '_blank')}
                />
              )}
              {msg.messageType === 'video' && msg.mediaUrl && (
                <VideoPlayer
                  src={msg.mediaUrl}
                  fileName={msg.fileName}
                  fromMe={msg.fromMe}
                />
              )}
              {msg.messageType === 'audio' && msg.mediaUrl && (
                <AudioPlayer
                  src={msg.mediaUrl}
                  fileName={msg.fileName}
                  fromMe={msg.fromMe}
                />
              )}
              {msg.messageType === 'sticker' && msg.mediaUrl && (
                // eslint-disable-next-line @next/next/no-img-element
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
              {msg.messageType === 'location' && msg.mediaMetadata && msg.mediaMetadata.latitude != null && msg.mediaMetadata.longitude != null && (() => {
                const lat = msg.mediaMetadata.latitude as number;
                const lng = msg.mediaMetadata.longitude as number;
                const name = msg.mediaMetadata.locationName as string | undefined;
                const address = msg.mediaMetadata.locationAddress as string | undefined;
                const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
                return (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 p-2 rounded-lg bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
                  >
                    {/* Map Icon */}
                    <div className="flex-shrink-0 w-12 h-12 bg-red-500 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    {/* Location Info */}
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-medium text-sm">{name || 'Ubicación'}</span>
                      {address && <span className="text-xs opacity-70 truncate">{address}</span>}
                      <span className="text-xs text-blue-500">{lat.toFixed(6)}, {lng.toFixed(6)}</span>
                    </div>
                  </a>
                );
              })()}

              {/* Text Body */}
              {msg.body ? (
                <span>{renderTextWithLinks(msg.body, msg.fromMe)}</span>
              ) : (
                msg.messageType !== 'text' && msg.messageType !== 'location' && !msg.mediaUrl && (
                  <span className="italic opacity-50">Media/Mensaje del sistema</span>
                )
              )}

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

              {/* Reactions */}
              {msg.reactions && msg.reactions.length > 0 && (
                <div className={cn(
                  "flex flex-wrap gap-1 -mb-4 mt-1",
                  msg.fromMe ? "justify-end" : "justify-start"
                )}>
                  {Object.entries(
                    msg.reactions.reduce((acc, r) => {
                      acc[r.emoji] = (acc[r.emoji] || 0) + 1;
                      return acc;
                    }, {} as Record<string, number>)
                  ).map(([emoji, count]) => (
                    <span
                      key={emoji}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-background border text-xs shadow-sm"
                    >
                      {emoji}
                      {count > 1 && <span className="text-muted-foreground text-[10px]">{count}</span>}
                    </span>
                  ))}
                </div>
              )}

              {/* Reaction Button */}
              <Popover open={openReactionId === msg.id} onOpenChange={(open) => setOpenReactionId(open ? msg.id : null)}>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "absolute -bottom-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full bg-background border shadow-sm hover:bg-muted",
                      msg.fromMe ? "left-0 -translate-x-full mr-1" : "right-0 translate-x-full ml-1"
                    )}
                  >
                    <SmilePlus className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-2" side={msg.fromMe ? "left" : "right"}>
                  <div className="flex gap-1">
                    {QUICK_REACTIONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => handleReaction(msg.id, emoji)}
                        disabled={isPending}
                        className="p-1.5 hover:bg-muted rounded transition-colors text-lg"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
