import { db } from "@/db";
import { whatsappTable, messageTable, contactTable, groupTable } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { ChatInput } from "./chat-input";
import { ChatMessages } from "./chat-messages";
import { getWAFromSlugUserIdCache } from "../../cache";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ slug: string; chatId: string }>;
}) {
  const { slug, chatId } = await params;
  const decodedChatId = decodeURIComponent(chatId);

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  const whatsapp = await getWAFromSlugUserIdCache({ slug, userId: session.user.id });

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

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <h3 className="font-semibold">{chatName}</h3>
        <p className="text-xs text-muted-foreground font-mono">{decodedChatId}</p>
      </div>
      
      <ChatMessages initialMessages={messages} chatId={decodedChatId} />
      
      <ChatInput slug={slug} chatId={decodedChatId} />
    </div>
  );
}
