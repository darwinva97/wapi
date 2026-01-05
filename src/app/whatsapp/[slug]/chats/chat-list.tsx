'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Chat {
  id: string;
  name: string;
  type: 'group' | 'personal';
  identifier: string;
  description?: string | null;
  pushName?: string;
  lastMessage?: string | null;
  lastMessageAt?: number | null;
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

export function ChatList({ chats, slug }: ChatListProps) {
  const pathname = usePathname();

  return (
    <ScrollArea className="flex-1 min-h-0 overflow-auto">
      <div className="flex flex-col gap-1 p-2">
        {chats.map((chat) => {
          const chatPath = `/whatsapp/${slug}/chats/${encodeURIComponent(chat.identifier)}`;
          const isActive = pathname === chatPath || pathname === decodeURIComponent(chatPath);
          
          return (
            <Link
              key={chat.id}
              href={chatPath}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg transition-colors text-left",
                isActive ? "bg-accent" : "hover:bg-accent"
              )}
            >
              <Avatar>
                <AvatarFallback>{chat.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{chat.name}</span>
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
  );
}
