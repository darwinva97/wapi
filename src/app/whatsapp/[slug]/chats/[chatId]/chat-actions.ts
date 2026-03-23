'use server';

import { db } from "@/db";
import { reactionTable } from "@/db/schema";
import { getWhatsappBySlugWithRole } from "@/lib/auth-utils";
import { getSocket } from "@/lib/whatsapp";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";

export async function sendReactionAction(
  slug: string,
  chatId: string,
  messageId: string,
  emoji: string
) {
  const { wa } = await getWhatsappBySlugWithRole(slug, "agent");

  const sock = getSocket(wa.id);

  if (!sock) {
    throw new Error("WhatsApp is not connected");
  }

  const senderId = sock.user?.id || "";

  await sock.sendMessage(chatId, {
    react: {
      text: emoji,
      key: {
        remoteJid: chatId,
        id: messageId,
        fromMe: false,
      },
    },
  });

  // Save reaction to database
  if (emoji === "") {
    // Remove reaction
    await db
      .delete(reactionTable)
      .where(
        and(
          eq(reactionTable.whatsappId, wa.id),
          eq(reactionTable.messageId, messageId),
          eq(reactionTable.senderId, senderId),
        ),
      );
  } else {
    // Add or update reaction
    await db
      .insert(reactionTable)
      .values({
        id: crypto.randomUUID(),
        whatsappId: wa.id,
        messageId: messageId,
        chatId: chatId,
        senderId: senderId,
        emoji: emoji,
        timestamp: new Date(),
        fromMe: true,
      })
      .onConflictDoUpdate({
        target: reactionTable.id,
        set: {
          emoji: emoji,
          timestamp: new Date(),
        },
      });
  }

  revalidatePath(`/whatsapp/${slug}/chats/${encodeURIComponent(chatId)}`);

  return { success: true };
}
