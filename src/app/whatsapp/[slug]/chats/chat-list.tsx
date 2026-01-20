'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useRef, useState, useEffect, useMemo } from "react";
import { Search } from "lucide-react";

interface Chat {
  id: string;
  name: string;
  type: 'group' | 'personal';
  identifier: string;
  description?: string | null;
  pushName?: string;
  lastMessage?: string | null;
  lastMessageAt?: number | null;
  pn?: string | null;
  lid?: string | null;
}

interface ChatListProps {
  chats: Chat[];
  slug: string;
}

function formatMessageTime(timestamp: number | null | undefined): string {
  if (!timestamp) return '';
  
  const date = new Date(timestamp);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Ayer';
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  } else {
    return date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });
  }
}

function MarqueeText({ text, className }: { text: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        const overflowAmount = textRef.current.scrollWidth - containerRef.current.clientWidth;
        setOverflow(overflowAmount > 0 ? overflowAmount : 0);
      }
    };
    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, [text]);

  const duration = Math.max(2, overflow / 40); // ~40px per second

  return (
    <div
      ref={containerRef}
      className={cn("overflow-hidden relative", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span
        ref={textRef}
        className="inline-block whitespace-nowrap"
        style={{
          transform: isHovered && overflow > 0 ? `translateX(-${overflow}px)` : 'translateX(0)',
          transition: isHovered && overflow > 0 
            ? `transform ${duration}s linear` 
            : 'transform 0.3s ease-out',
        }}
      >
        {text}
      </span>
      {/* Gradient fade when text is truncated */}
      {!isHovered && overflow > 0 && (
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-linear-to-l from-background to-transparent pointer-events-none" />
      )}
    </div>
  );
}

export function ChatList({ chats, slug }: ChatListProps) {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;

    const query = searchQuery.toLowerCase().trim();
    return chats.filter((chat) => {
      const name = (chat.name || '').toLowerCase();
      const pushName = (chat.pushName || '').toLowerCase();
      const identifier = (chat.identifier || '').toLowerCase();
      const pn = (chat.pn || '').toLowerCase();
      const lid = (chat.lid || '').toLowerCase();

      return (
        name.includes(query) ||
        pushName.includes(query) ||
        identifier.includes(query) ||
        pn.includes(query) ||
        lid.includes(query)
      );
    });
  }, [chats, searchQuery]);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Sticky Search Header */}
      <div className="p-2 border-b sticky top-0 bg-background z-10">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contacto, número..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0 overflow-auto max-w-full">
        <div className="flex flex-col gap-1 p-2">
          {filteredChats.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">
              No se encontraron conversaciones
            </div>
          ) : filteredChats.map((chat) => {
          const chatPath = `/whatsapp/${slug}/chats/${encodeURIComponent(chat.identifier)}`;
          const isActive = pathname === chatPath || pathname === decodeURIComponent(chatPath);
          
          return (
            <Link
              key={chat.id}
              href={chatPath}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg transition-colors text-left max-w-[300px]",
                isActive ? "bg-accent" : "hover:bg-accent"
              )}
            >
              <Avatar>
                <AvatarFallback>{chat.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden min-w-0 w-full">
                <div className="flex items-center justify-between gap-2">
                  <MarqueeText text={chat.name} className="font-medium flex-1 min-w-0" />
                  <div className="flex items-center gap-1 shrink-0">
                    {chat.type === 'group' && <Badge variant="secondary" className="text-[10px] h-4 px-1">Grupo</Badge>}
                    {chat.lastMessageAt && (
                      <span className="text-[10px] text-muted-foreground" suppressHydrationWarning>
                        {formatMessageTime(chat.lastMessageAt)}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {chat.lastMessage || (chat.type === 'group' ? chat.description : chat.pushName) || 'Sin mensajes'}
                </p>
              </div>
            </Link>
          );
        })}
        </div>
      </ScrollArea>
    </div>
  );
}
