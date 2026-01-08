import { db } from "@/db";
import { groupTable, contactTable, messageTable } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { Suspense } from "react";
import { getWAFromSlugUserIdCache } from "../cache";
import { ChatList } from "./chat-list";

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

  // Get last message for each chat
  const lastMessages = await db
    .select({
      chatId: messageTable.chatId,
      lastMessageBody: messageTable.body,
      lastMessageTimestamp: sql<number>`MAX(${messageTable.timestamp})`.as('last_timestamp'),
    })
    .from(messageTable)
    .where(eq(messageTable.whatsappId, whatsapp.id))
    .groupBy(messageTable.chatId);

  const lastMessageMap = new Map(
    lastMessages.map(m => [m.chatId, { body: m.lastMessageBody, timestamp: m.lastMessageTimestamp }])
  );

  const allChats = [
    ...groups.map(g => ({ 
      ...g, 
      type: 'group' as const, 
      identifier: g.gid,
      lastMessage: lastMessageMap.get(g.gid)?.body || null,
      lastMessageAt: lastMessageMap.get(g.gid)?.timestamp || null,
    })),
    ...contacts.map(c => {
      const identifier = c.pn || c.lid;
      // Try different JID formats
      const jidVariants = [
        identifier,
        `${identifier}@s.whatsapp.net`,
        identifier.replace('@s.whatsapp.net', ''),
      ];
      const lastMsg = jidVariants.reduce((found, jid) => found || lastMessageMap.get(jid), undefined as { body: string | null; timestamp: number } | undefined);
      return { 
        ...c, 
        type: 'personal' as const, 
        identifier,
        lastMessage: lastMsg?.body || null,
        lastMessageAt: lastMsg?.timestamp || null,
      };
    })
  ].sort((a, b) => {
    // Sort by last message timestamp (most recent first), null values go to the end
    if (a.lastMessageAt === null && b.lastMessageAt === null) {
      return (a.name || '').localeCompare(b.name || '');
    }
    if (a.lastMessageAt === null) return 1;
    if (b.lastMessageAt === null) return -1;
    return b.lastMessageAt - a.lastMessageAt;
  });

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden border rounded-lg bg-background">
      <div className="w-80 border-r flex flex-col min-h-0 overflow-hidden">
        <div className="p-4 border-b shrink-0 bg-background">
          <h2 className="font-semibold">Conversaciones</h2>
        </div>
        <ChatList chats={allChats} slug={slug} />
      </div>
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
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
