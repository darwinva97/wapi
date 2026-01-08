import { db } from "@/db";
import { contactTable, groupTable, messageTable } from "@/db/schema";
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
  }).then(msgs => msgs.map(msg => ({
    ...msg,
    mediaMetadata: msg.mediaMetadata as Record<string, unknown> | undefined
  })));

  // Fetch sender names for group messages
  const senderMap = new Map<string, string>();
  if (decodedChatId.includes('@g.us')) {
    // Get unique sender IDs
    const senderIds = [...new Set(messages.map(m => m.senderId).filter(Boolean))];
    
    // Fetch contact information for each sender
    for (const senderId of senderIds) {
      // Try to find by lid first
      let contact = await db.query.contactTable.findFirst({
        where: and(
          eq(contactTable.whatsappId, whatsapp.id),
          eq(contactTable.lid, senderId)
        )
      });
      
      // If not found, try by pn
      if (!contact) {
        contact = await db.query.contactTable.findFirst({
          where: and(
            eq(contactTable.whatsappId, whatsapp.id),
            eq(contactTable.pn, senderId)
          )
        });
      }
      
      if (contact) {
        senderMap.set(senderId, contact.name || contact.pushName || senderId);
      } else {
        // Fallback: extract phone number or use senderId
        const phoneMatch = senderId.match(/(\d+)/);
        senderMap.set(senderId, phoneMatch ? phoneMatch[1] : senderId);
      }
    }
  }

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
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <div className="p-4 border-b bg-background shrink-0">
        <h3 className="font-semibold">{chatName}</h3>
        <p className="text-xs text-muted-foreground font-mono">{decodedChatId}</p>
      </div>
      
      <ChatMessages 
        initialMessages={messages} 
        chatId={decodedChatId}
        senderNames={Object.fromEntries(senderMap)}
        isGroup={decodedChatId.includes('@g.us')}
      />
      
      <ChatInput slug={slug} chatId={decodedChatId} />
    </div>
  );
}
