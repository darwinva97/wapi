import { db } from "@/db";
import { whatsappTable, messageTable, contactTable, groupTable } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { ChatInput } from "./chat-input";
import { ChatMessages } from "./chat-messages";
import { ChatInfoPanel } from "./chat-info-panel";
import {
  getChatInfo,
  getChatLinks,
  getChatAssets,
  getChatNotes,
} from "./chat-info-actions";
import { getInstanceRole } from "@/lib/auth-utils";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ slug: string; connectionSlug: string; chatId: string }>;
}) {
  const { slug, connectionSlug, chatId } = await params;
  const decodedChatId = decodeURIComponent(chatId);

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const whatsapp = await db.query.whatsappTable.findFirst({
    where: eq(whatsappTable.slug, slug),
  });

  if (!whatsapp) return notFound();

  // Fetch messages
  const messages = await db.query.messageTable.findMany({
    where: and(
      eq(messageTable.whatsappId, whatsapp.id),
      eq(messageTable.chatId, decodedChatId)
    ),
    orderBy: asc(messageTable.timestamp),
  });

  // Fetch chat info for header
  let chatName = decodedChatId;
  if (decodedChatId.includes('@g.us')) {
    const group = await db.query.groupTable.findFirst({
      where: and(eq(groupTable.whatsappId, whatsapp.id), eq(groupTable.gid, decodedChatId))
    });
    if (group) chatName = group.name;
  } else {
    const contact = await db.query.contactTable.findFirst({
      where: and(
        eq(contactTable.whatsappId, whatsapp.id), 
        eq(contactTable.pn, decodedChatId) 
      )
    });
    if (contact) {
        chatName = contact.name || contact.pushName;
    } else {
        const contactLid = await db.query.contactTable.findFirst({
            where: and(eq(contactTable.whatsappId, whatsapp.id), eq(contactTable.lid, decodedChatId))
        });
        if (contactLid) chatName = contactLid.name || contactLid.pushName;
    }
  }

  const typedMessages = messages.map(msg => ({
    ...msg,
    mediaMetadata: msg.mediaMetadata as Record<string, unknown> | undefined
  }));

  // Fetch chat info panel data
  const [chatInfo, links, assets, notes] = await Promise.all([
    getChatInfo(slug, decodedChatId),
    getChatLinks(slug, decodedChatId),
    getChatAssets(slug, decodedChatId),
    getChatNotes(slug, decodedChatId),
  ]);

  // Get user's role to determine if they can manage notes
  const role = await getInstanceRole(whatsapp.id, session.user.id);
  const canManageNotes = role !== null;

  return (
    <div className="flex flex-col h-full max-h-full min-h-0 overflow-hidden">
      {/* Sticky Header */}
      <div className="shrink-0 sticky top-0 z-10 bg-background">
        <ChatInfoPanel
          slug={slug}
          connectionSlug={connectionSlug}
          chatId={decodedChatId}
          chatName={chatName}
          chatInfo={chatInfo}
          links={links}
          assets={assets}
          notes={notes}
          canManageNotes={canManageNotes}
        />
      </div>

      {/* Scrollable Messages */}
      <ChatMessages initialMessages={typedMessages} chatId={decodedChatId} />

      {/* Sticky Input at Bottom */}
      <div className="shrink-0 sticky bottom-0 bg-background">
        <ChatInput slug={slug} connectionSlug={connectionSlug} chatId={decodedChatId} />
      </div>
    </div>
  );
}
