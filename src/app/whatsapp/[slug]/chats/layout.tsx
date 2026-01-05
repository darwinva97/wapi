import { db } from "@/db";
import { whatsappTable, groupTable, contactTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { getWAFromSlugUserIdCache } from "../cache";

async function ChatsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const whatsapp = await getWAFromSlugUserIdCache({ slug, userId: session.user.id });

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
    <div className="flex h-[calc(100vh-12rem)] overflow-hidden border rounded-lg bg-background">
      <div className="w-80 border-r flex flex-col min-h-0">
        <div className="p-4 border-b shrink-0">
          <h2 className="font-semibold">Conversaciones</h2>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="flex flex-col gap-1 p-2">
            {allChats.map((chat) => (
              <Link
                key={chat.id}
                href={`/whatsapp/${slug}/chats/${encodeURIComponent(chat.identifier)}`}
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
                    {chat.type === 'group' && <Badge variant="secondary" className="text-[10px] h-4 px-1">Grupo</Badge>}
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
  params: Promise<{ slug: string }>;
}) {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center">Cargando chats...</div>}>
      <ChatsLayout params={params}>
        {children}
      </ChatsLayout>
    </Suspense>
  )
}
