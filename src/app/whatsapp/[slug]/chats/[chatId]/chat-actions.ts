'use server';

import { getWhatsappBySlugWithRole } from "@/lib/auth-utils";
import { revalidatePath } from "next/cache";

const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'http://localhost:3001';

export async function sendReactionAction(
  slug: string,
  chatId: string,
  messageId: string,
  emoji: string
) {
  const { wa } = await getWhatsappBySlugWithRole(slug, "agent");

  // Send reaction via WhatsApp API
  const response = await fetch(`${WHATSAPP_API_URL}/api/whatsapp/${wa.phoneNumber}/react`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      chatId,
      messageId,
      emoji,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Error sending reaction: ${error}`);
  }

  revalidatePath(`/whatsapp/${slug}/chats/${encodeURIComponent(chatId)}`);

  return { success: true };
}
