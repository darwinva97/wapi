'use server';

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { whatsappTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import { getSocket } from "@/lib/whatsapp";
import { revalidatePath } from "next/cache";

export async function sendMessageAction(
  slug: string,
  chatId: string,
  message: string
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  const wa = await db.query.whatsappTable.findFirst({
    where: and(
      eq(whatsappTable.slug, slug),
      eq(whatsappTable.userId, session.user.id)
    ),
  });

  if (!wa) {
    throw new Error("WhatsApp instance not found");
  }

  const sock = getSocket(wa.id);

  if (!sock) {
    // Check if DB says connected but socket is missing (Zombie state)
    if (wa.connected) {
      await db.update(whatsappTable)
        .set({ connected: false })
        .where(eq(whatsappTable.id, wa.id));
      revalidatePath(`/whatsapp/${slug}`);
    }
    throw new Error("WhatsApp is not connected");
  }

  await sock.sendMessage(chatId, { text: message });
  
  // Revalidate the chat page to show the new message
  revalidatePath(`/whatsapp/${slug}/chats/${encodeURIComponent(chatId)}`);
  
  return { success: true };
}
