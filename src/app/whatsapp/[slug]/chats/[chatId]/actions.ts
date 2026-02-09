'use server';

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { getWhatsappBySlugWithRole } from "@/lib/auth-utils";
import { ELIXIR_API_URL } from "@/config/elixir";
import { saveFile } from "@/lib/storage";

async function getAuthToken(): Promise<string> {
  const cookieStore = await cookies();
  const token = cookieStore.get("better-auth.session_token")?.value;
  if (!token) throw new Error("Not authenticated");
  return token;
}

export async function sendMessageAction(
  slug: string,
  chatId: string,
  message: string
) {
  const { wa } = await getWhatsappBySlugWithRole(slug, "agent");
  const token = await getAuthToken();

  const response = await fetch(`${ELIXIR_API_URL}/api/v1/sessions/${wa.id}/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ to: chatId, message: { text: message } }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to send message");
  }

  revalidatePath(`/whatsapp/${slug}/chats/${encodeURIComponent(chatId)}`);

  return { success: true };
}

export async function sendMediaMessageAction(
  slug: string,
  chatId: string,
  formData: FormData
) {
  const { wa } = await getWhatsappBySlugWithRole(slug, "agent");
  const token = await getAuthToken();

  const file = formData.get('file') as File;
  const caption = formData.get('caption') as string | null;

  if (!file) {
    throw new Error("No file provided");
  }

  // Read file as buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Save file to storage
  const uploadResult = await saveFile(buffer, file.name, file.type, wa.id);

  if (!uploadResult.success || !uploadResult.url) {
    throw new Error(uploadResult.error || "Failed to upload file");
  }

  // Determine message type and build Baileys message format
  let messageContent: Record<string, unknown>;

  if (file.type.startsWith('image/')) {
    if (file.type === 'image/webp') {
      messageContent = { sticker: { url: uploadResult.url } };
    } else {
      messageContent = { image: { url: uploadResult.url }, caption: caption || undefined };
    }
  } else if (file.type.startsWith('video/')) {
    messageContent = { video: { url: uploadResult.url }, caption: caption || undefined };
  } else if (file.type.startsWith('audio/')) {
    messageContent = { audio: { url: uploadResult.url }, ptt: file.type === 'audio/ogg' };
  } else {
    messageContent = { document: { url: uploadResult.url }, mimetype: file.type, fileName: file.name };
  }

  const response = await fetch(`${ELIXIR_API_URL}/api/v1/sessions/${wa.id}/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ to: chatId, message: messageContent }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to send media");
  }

  revalidatePath(`/whatsapp/${slug}/chats/${encodeURIComponent(chatId)}`);

  return { success: true, mediaUrl: uploadResult.url };
}
