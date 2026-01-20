'use server';

import { db } from "@/db";
import { whatsappTable, messageTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSocket } from "@/lib/whatsapp";
import { revalidatePath } from "next/cache";
import { getWhatsappBySlugWithRole } from "@/lib/auth-utils";
import { isGroup } from "@/lib/whatsapp-utils";
import { saveFile } from "@/lib/storage";

export async function sendMessageAction(
  slug: string,
  chatId: string,
  message: string
) {
  // Verify user has at least agent role to send messages
  const { wa, user } = await getWhatsappBySlugWithRole(slug, "agent");

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

  const result = await sock.sendMessage(chatId, { text: message });

  // Save message to database with tracking
  if (result?.key?.id) {
    const timestamp = new Date();
    const isGroupChat = isGroup(chatId);

    await db.insert(messageTable).values({
      id: result.key.id,
      whatsappId: wa.id,
      chatId: chatId,
      chatType: isGroupChat ? 'group' : 'personal',
      senderId: sock.user?.id || chatId,
      content: result,
      body: message,
      timestamp: timestamp,
      fromMe: true,
      messageType: 'text',
      ackStatus: 1, // SENT
      sentFromPlatform: true,
      sentByUserId: user.id,
    }).onConflictDoNothing();
  }

  // Revalidate the chat page to show the new message
  revalidatePath(`/whatsapp/${slug}/chats/${encodeURIComponent(chatId)}`);

  return { success: true };
}

export async function sendMediaMessageAction(
  slug: string,
  chatId: string,
  formData: FormData
) {
  // Verify user has at least agent role to send messages
  const { wa, user } = await getWhatsappBySlugWithRole(slug, "agent");

  const sock = getSocket(wa.id);

  if (!sock) {
    if (wa.connected) {
      await db.update(whatsappTable)
        .set({ connected: false })
        .where(eq(whatsappTable.id, wa.id));
      revalidatePath(`/whatsapp/${slug}`);
    }
    throw new Error("WhatsApp is not connected");
  }

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

  // Determine message type based on MIME type
  let messageContent: Record<string, unknown>;
  let messageType: 'image' | 'video' | 'audio' | 'document' | 'sticker';

  if (file.type.startsWith('image/')) {
    if (file.type === 'image/webp') {
      messageType = 'sticker';
      messageContent = { sticker: buffer, mimetype: 'image/webp' };
    } else {
      messageType = 'image';
      messageContent = { image: buffer, mimetype: file.type, caption: caption || undefined };
    }
  } else if (file.type.startsWith('video/')) {
    messageType = 'video';
    messageContent = { video: buffer, mimetype: file.type, caption: caption || undefined };
  } else if (file.type.startsWith('audio/')) {
    messageType = 'audio';
    messageContent = { audio: buffer, mimetype: file.type, ptt: file.type === 'audio/ogg' };
  } else {
    messageType = 'document';
    messageContent = {
      document: buffer,
      mimetype: file.type,
      fileName: file.name
    };
  }

  const result = await sock.sendMessage(chatId, messageContent as never);

  // Save message to database with tracking
  if (result?.key?.id) {
    const timestamp = new Date();
    const isGroupChat = isGroup(chatId);

    await db.insert(messageTable).values({
      id: result.key.id,
      whatsappId: wa.id,
      chatId: chatId,
      chatType: isGroupChat ? 'group' : 'personal',
      senderId: sock.user?.id || chatId,
      content: result,
      body: caption || '',
      timestamp: timestamp,
      fromMe: true,
      messageType: messageType,
      mediaUrl: uploadResult.url,
      mediaMetadata: JSON.stringify({
        mimetype: file.type,
        size: buffer.length,
        fileName: file.name,
      }),
      fileName: file.name,
      ackStatus: 1, // SENT
      sentFromPlatform: true,
      sentByUserId: user.id,
    }).onConflictDoNothing();
  }

  // Revalidate the chat page to show the new message
  revalidatePath(`/whatsapp/${slug}/chats/${encodeURIComponent(chatId)}`);

  return { success: true, mediaUrl: uploadResult.url };
}
