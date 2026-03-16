import { db } from "@/db";
import { groupTable, contactTable, messageTable, chatConfigTable } from "@/db/schema";
import { eq, sql, desc } from "drizzle-orm";
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

  // Build chat list FROM MESSAGES - get all unique chatIds with their last message
  const chatSummaries = await db
    .select({
      chatId: messageTable.chatId,
      lastBody: sql<string>`(array_agg(${messageTable.body} ORDER BY ${messageTable.timestamp} DESC))[1]`,
      lastTimestamp: sql<Date>`MAX(${messageTable.timestamp})`,
      chatType: sql<string>`(array_agg(${messageTable.chatType} ORDER BY ${messageTable.timestamp} DESC))[1]`,
    })
    .from(messageTable)
    .where(eq(messageTable.whatsappId, whatsapp.id))
    .groupBy(messageTable.chatId)
    .orderBy(desc(sql`MAX(${messageTable.timestamp})`));

  // Fetch contacts and groups for name resolution
  const [contacts, groups, chatConfigs] = await Promise.all([
    db.query.contactTable.findMany({
      where: eq(contactTable.whatsappId, whatsapp.id),
    }),
    db.query.groupTable.findMany({
      where: eq(groupTable.whatsappId, whatsapp.id),
    }),
    db.query.chatConfigTable.findMany({
      where: eq(chatConfigTable.whatsappId, whatsapp.id),
    }),
  ]);

  // Build lookup maps
  const customNameMap = new Map(
    chatConfigs
      .filter(c => c.customName)
      .map(c => [c.chatId, c.customName])
  );

  const groupMap = new Map(groups.map(g => [g.gid, g]));

  // Build contact lookup and track which contact each chatId belongs to
  // A contact can have multiple JIDs (lid, pn), so multiple chatIds may map to the same contact
  const contactByJid = new Map<string, typeof contacts[0]>();
  for (const c of contacts) {
    if (c.lid) contactByJid.set(c.lid, c);
    if (c.pn) contactByJid.set(c.pn, c);
    if (c.pn) {
      const normalized = `${c.pn.split('@')[0]}@s.whatsapp.net`;
      contactByJid.set(normalized, c);
    }
  }

  // Deduplicate: merge chatIds that belong to the same contact
  // Keep the one with the most recent message as the primary chatId
  const seenContactIds = new Set<string>();
  const allChats: {
    id: string;
    name: string;
    pushName: string;
    type: 'group' | 'personal';
    identifier: string;
    description: string | null;
    customName: string | null;
    lastMessage: string | null;
    lastMessageAt: number | null;
    pn: string | null;
    lid: string | null;
  }[] = [];

  for (const summary of chatSummaries) {
    const isGroup = summary.chatId.includes('@g.us');
    const group = isGroup ? groupMap.get(summary.chatId) : null;
    const contact = !isGroup ? contactByJid.get(summary.chatId) : null;

    // Deduplicate personal chats: skip if we already have this contact
    if (contact && !isGroup) {
      if (seenContactIds.has(contact.id)) {
        continue; // Already added this contact with a more recent chatId
      }
      seenContactIds.add(contact.id);
    }

    let name = '';
    let pushName = '';
    let pn: string | null = null;
    let lid: string | null = null;

    if (group) {
      name = group.name;
      pushName = group.pushName || '';
    } else if (contact) {
      name = contact.name;
      pushName = contact.pushName || '';
      pn = contact.pn || null;
      lid = contact.lid || null;
    } else {
      // No contact/group found - extract phone from chatId
      const phone = summary.chatId.split('@')[0];
      name = phone;
      pushName = '';
      pn = summary.chatId;
    }

    allChats.push({
      id: summary.chatId,
      name,
      pushName,
      type: isGroup ? 'group' as const : 'personal' as const,
      identifier: summary.chatId,
      description: group?.description || null,
      customName: customNameMap.get(summary.chatId) || null,
      lastMessage: summary.lastBody || null,
      lastMessageAt: summary.lastTimestamp ? new Date(summary.lastTimestamp).getTime() : null,
      pn,
      lid,
    });
  }

  return (
    <div className="flex h-full max-h-full min-h-0 overflow-hidden rounded-lg border bg-background">
      <div className="w-80 border-r flex flex-col h-full max-h-full min-h-0 overflow-hidden">
        <div className="p-4 border-b shrink-0 bg-background sticky top-0 z-20">
          <h2 className="font-mono font-semibold">Conversaciones</h2>
        </div>
        <ChatList chats={allChats} slug={slug} whatsappId={whatsapp.id} />
      </div>
      <div className="flex-1 flex flex-col h-full max-h-full min-h-0 overflow-hidden">
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
