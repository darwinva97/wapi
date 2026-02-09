'use server';

import { db } from "@/db";
import { reactionTable } from "@/db/schema";
import { getWhatsappBySlugWithRole } from "@/lib/auth-utils";
import { ELIXIR_API_URL } from "@/config/elixir";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";

async function getAuthToken(): Promise<string> {
  const cookieStore = await cookies();
  const token = cookieStore.get("better-auth.session_token")?.value;
  if (!token) throw new Error("Not authenticated");
  return token;
}

export async function sendReactionAction(
  slug: string,
  chatId: string,
  messageId: string,
  emoji: string
) {
  const { wa } = await getWhatsappBySlugWithRole(slug, "agent");
  const token = await getAuthToken();

  // Send reaction via Elixir
  const response = await fetch(`${ELIXIR_API_URL}/api/v1/sessions/${wa.id}/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      to: chatId,
      message: { react: { text: emoji, key: { remoteJid: chatId, id: messageId, fromMe: false } } },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to send reaction");
  }

  const senderId = wa.id;

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
