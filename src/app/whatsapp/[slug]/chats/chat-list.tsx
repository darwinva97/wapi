'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useRef, useState, useEffect, useMemo, useCallback } from "react";
import { Search, Loader2 } from "lucide-react";

interface Chat {
  id: string;
  name: string;
  type: 'group' | 'personal';
  identifier: string;
  description?: string | null;
  pushName?: string;
  customName?: string | null;
  lastMessage?: string | null;
  lastMessageAt?: number | null;
  pn?: string | null;
  lid?: string | null;
}

interface ChatListProps {
  chats: Chat[];
  slug: string;
  whatsappId: string;
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

function useProfilePictures(whatsappId: string, visibleIdentifiers: string[]) {
  const [picUrls, setPicUrls] = useState<Map<string, string | null>>(new Map());
  const fetchingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const toFetch = visibleIdentifiers.filter(
      (id) => !picUrls.has(id) && !fetchingRef.current.has(id)
    );
    if (toFetch.length === 0) return;

    for (const jid of toFetch) {
      fetchingRef.current.add(jid);
      fetch(`/api/whatsapp/${whatsappId}/profile-picture?jid=${encodeURIComponent(jid)}`)
        .then((res) => res.json())
        .then((data: { url: string | null }) => {
          setPicUrls((prev) => {
            const next = new Map(prev);
            next.set(jid, data.url);
            return next;
          });
        })
        .catch(() => {
          setPicUrls((prev) => {
            const next = new Map(prev);
            next.set(jid, null);
            return next;
          });
        })
        .finally(() => {
          fetchingRef.current.delete(jid);
        });
    }
  }, [whatsappId, visibleIdentifiers, picUrls]);

  return picUrls;
}

export function ChatList({ chats, slug, whatsappId }: ChatListProps) {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");

  const filteredChats = useMemo(() => {
    if (!searchQuery.trim()) return chats;

    const query = searchQuery.toLowerCase().trim();
    return chats.filter((chat) => {
      const name = (chat.name || '').toLowerCase();
      const customName = (chat.customName || '').toLowerCase();
      const pushName = (chat.pushName || '').toLowerCase();
      const identifier = (chat.identifier || '').toLowerCase();
      const pn = (chat.pn || '').toLowerCase();
      const lid = (chat.lid || '').toLowerCase();

      return (
        name.includes(query) ||
        customName.includes(query) ||
        pushName.includes(query) ||
        identifier.includes(query) ||
        pn.includes(query) ||
        lid.includes(query)
      );
    });
  }, [chats, searchQuery]);

  // All chats come from messages table, already sorted by most recent
  const displayChats = filteredChats;

  const PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Reset visible count when search query changes
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery]);


  const isSearching = searchQuery.trim().length > 0;
  const paginatedChats = isSearching ? displayChats : displayChats.slice(0, visibleCount);
  const hasMore = !isSearching && visibleCount < displayChats.length;

  // Track which chat items are visible on screen for lazy profile picture loading
  const [visibleIds, setVisibleIds] = useState<Set<string>>(new Set());
  const chatItemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const visibilityObserverRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    visibilityObserverRef.current = new IntersectionObserver(
      (entries) => {
        setVisibleIds((prev) => {
          const next = new Set(prev);
          let changed = false;
          for (const entry of entries) {
            const id = (entry.target as HTMLElement).dataset.chatIdentifier;
            if (!id) continue;
            if (entry.isIntersecting && !next.has(id)) {
              next.add(id);
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      },
      { rootMargin: '100px' }
    );

    // Observe all currently registered refs
    for (const el of chatItemRefs.current.values()) {
      visibilityObserverRef.current.observe(el);
    }

    return () => visibilityObserverRef.current?.disconnect();
  }, [paginatedChats]);

  const chatItemRef = useCallback((identifier: string, el: HTMLElement | null) => {
    if (el) {
      chatItemRefs.current.set(identifier, el);
      visibilityObserverRef.current?.observe(el);
    } else {
      const prev = chatItemRefs.current.get(identifier);
      if (prev) visibilityObserverRef.current?.unobserve(prev);
      chatItemRefs.current.delete(identifier);
    }
  }, []);

  const visibleIdentifiers = useMemo(() => Array.from(visibleIds), [visibleIds]);
  const profilePicUrls = useProfilePictures(whatsappId, visibleIdentifiers);

  // IntersectionObserver to load more chats when sentinel is visible
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isSearching) {
          setVisibleCount((prev) => Math.min(prev + PAGE_SIZE, displayChats.length));
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [displayChats.length, isSearching]);

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
          {paginatedChats.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">
              No se encontraron conversaciones
            </div>
          ) : paginatedChats.map((chat) => {
          const chatPath = `/whatsapp/${slug}/chats/${encodeURIComponent(chat.identifier)}`;
          const isActive = pathname === chatPath || pathname === decodeURIComponent(chatPath);

          // Get display name with fallbacks: customName > name > phone number > identifier
          const rawName = chat.customName || chat.name;
          const isValidName = rawName && rawName.trim().length > 1 && rawName !== '.';
          const phoneNumber = chat.pn?.split('@')[0] || chat.lid?.split('@')[0];
          const displayName = isValidName ? rawName : (phoneNumber || chat.identifier || '?');
          const profilePicUrl = profilePicUrls.get(chat.identifier);

          return (
            <Link
              key={chat.id}
              href={chatPath}
              ref={(el) => chatItemRef(chat.identifier, el)}
              data-chat-identifier={chat.identifier}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg transition-colors text-left max-w-[300px]",
                isActive ? "bg-accent" : "hover:bg-accent"
              )}
            >
              <div className="relative shrink-0">
                <Avatar>
                  {profilePicUrl && (
                    <AvatarImage src={profilePicUrl} alt={displayName} />
                  )}
                  <AvatarFallback suppressHydrationWarning>{displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </div>
              <div className="flex-1 overflow-hidden min-w-0 w-full">
                <div className="flex items-center justify-between gap-2">
                  <MarqueeText text={displayName} className="flex-1 min-w-0 font-semibold" />
                  <div className="flex items-center gap-1 shrink-0">
                    {chat.type === 'group' && <Badge variant="secondary" className="text-[10px] h-4 px-1 rounded-full">Grupo</Badge>}
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

          {/* Sentinel for infinite scroll */}
          <div ref={sentinelRef} className="h-1" />
          {hasMore && (
            <div className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              Cargando más...
            </div>
          )}

        </div>
      </ScrollArea>
    </div>
  );
}
