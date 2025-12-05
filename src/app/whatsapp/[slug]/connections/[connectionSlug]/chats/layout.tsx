import { db } from "@/db";
import { whatsappTable, groupTable, contactTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Suspense } from "react";

async function ChatsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; connectionSlug: string }>;
}) {
  const { slug, connectionSlug } = await params;

  const whatsapp = await db.query.whatsappTable.findFirst({
    where: eq(whatsappTable.slug, slug),
  });

  if (!whatsapp) return notFound();

  const groups = await db.query.groupTable.findMany({
    where: eq(groupTable.whatsappId, whatsapp.id),
  });

  const contacts = await db.query.contactTable.findMany({
    where: eq(contactTable.whatsappId, whatsapp.id),
  });

  const allChats = [
    ...groups.map(g => ({ ...g, type: 'group' as const, identifier: g.gid })),
    ...contacts.map(c => ({ ...c, type: 'personal' as const, identifier: c.pn || c.lid }))
  ].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden border rounded-lg bg-background">
      <div className="w-80 border-r flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Chats</h2>
        </div>
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-1 p-2">
            {allChats.map((chat) => (
              <Link
                key={chat.id}
                href={`/whatsapp/${slug}/connections/${connectionSlug}/chats/${encodeURIComponent(chat.identifier)}`}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                )}
              >
                <Avatar>
                  <AvatarFallback>{chat.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{chat.name}</span>
                    {chat.type === 'group' && <Badge variant="secondary" className="text-[10px] h-4 px-1">Group</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">
                    {chat.type === 'group' ? chat.description : chat.pushName}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </ScrollArea>
      </div>
      <div className="flex-1 flex flex-col">
        {children}
      </div>
    </div>
  );
}

export default async function ChatsLayoutWrapper({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string; connectionSlug: string }>;
}) {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center">Cargando chats...</div>}>
      <ChatsLayout params={params}>
        {children}
      </ChatsLayout>
    </Suspense>
  )
}