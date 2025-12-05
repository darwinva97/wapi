'use server';

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { whatsappTable, connectionTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import { getSocket } from "@/lib/whatsapp";
import { revalidatePath } from "next/cache";

export async function sendMessageAction(
  slug: string,
  connectionSlug: string,
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

  const connection = await db.query.connectionTable.findFirst({
    where: and(
      eq(connectionTable.slug, connectionSlug),
      eq(connectionTable.whatsappId, wa.id)
    ),
  });

  if (!connection) {
    throw new Error("Connection not found");
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
  revalidatePath(`/whatsapp/${slug}/connections/${connectionSlug}/chats/${encodeURIComponent(chatId)}`);
  
  return { success: true };
}
