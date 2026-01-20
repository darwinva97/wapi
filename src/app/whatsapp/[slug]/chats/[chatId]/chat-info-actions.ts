'use server';

import { db } from "@/db";
import { messageTable, chatConfigTable, chatNoteTable } from "@/db/schema";
import { eq, and, desc, asc, isNotNull, count, min } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getWhatsappBySlugWithRole, hasMinimumRole } from "@/lib/auth-utils";
import { randomUUID } from "crypto";

export interface ChatInfoData {
  isGroup: boolean;
  totalMessages: number;
  totalMedia: number;
  firstMessage: Date | null;
  config: {
    customName: string | null;
    cleanupExcluded: boolean;
    cleanupIncluded: boolean;
  } | null;
}

export interface ChatLink {
  url: string;
  messageId: string;
  sender: string;
  timestamp: Date;
}

export interface ChatAsset {
  messageId: string;
  url: string;
  type: string;
  fileName: string | null;
  timestamp: Date;
  retentionUntil: Date | null;
}

export interface ChatNote {
  id: string;
  content: string;
  createdAt: Date;
  createdByName: string;
  createdById: string;
  canDelete: boolean;
}

// URL regex pattern
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

export async function getChatInfo(
  slug: string,
  chatId: string
): Promise<ChatInfoData> {
  const { wa } = await getWhatsappBySlugWithRole(slug, "agent");

  const isGroup = chatId.includes("@g.us");

  // Get message counts
  const [messageCount] = await db
    .select({ count: count() })
    .from(messageTable)
    .where(
      and(
        eq(messageTable.whatsappId, wa.id),
        eq(messageTable.chatId, chatId)
      )
    );

  const [mediaCount] = await db
    .select({ count: count() })
    .from(messageTable)
    .where(
      and(
        eq(messageTable.whatsappId, wa.id),
        eq(messageTable.chatId, chatId),
        isNotNull(messageTable.mediaUrl)
      )
    );

  // Get first message date
  const [firstMsg] = await db
    .select({ timestamp: min(messageTable.timestamp) })
    .from(messageTable)
    .where(
      and(
        eq(messageTable.whatsappId, wa.id),
        eq(messageTable.chatId, chatId)
      )
    );

  // Get chat config
  const config = await db.query.chatConfigTable.findFirst({
    where: and(
      eq(chatConfigTable.whatsappId, wa.id),
      eq(chatConfigTable.chatId, chatId)
    ),
  });

  return {
    isGroup,
    totalMessages: messageCount?.count ?? 0,
    totalMedia: mediaCount?.count ?? 0,
    firstMessage: firstMsg?.timestamp ?? null,
    config: config ? {
      customName: config.customName,
      cleanupExcluded: config.cleanupExcluded,
      cleanupIncluded: config.cleanupIncluded,
    } : null,
  };
}

export async function getChatLinks(
  slug: string,
  chatId: string
): Promise<ChatLink[]> {
  const { wa } = await getWhatsappBySlugWithRole(slug, "agent");

  const messages = await db.query.messageTable.findMany({
    where: and(
      eq(messageTable.whatsappId, wa.id),
      eq(messageTable.chatId, chatId)
    ),
    orderBy: desc(messageTable.timestamp),
    columns: {
      id: true,
      body: true,
      senderId: true,
      timestamp: true,
    },
  });

  const links: ChatLink[] = [];

  for (const msg of messages) {
    if (!msg.body) continue;

    const urls = msg.body.match(URL_REGEX);
    if (urls) {
      for (const url of urls) {
        links.push({
          url,
          messageId: msg.id,
          sender: msg.senderId?.split("@")[0] || "Unknown",
          timestamp: msg.timestamp,
        });
      }
    }
  }

  return links;
}

export async function getChatAssets(
  slug: string,
  chatId: string
): Promise<ChatAsset[]> {
  const { wa } = await getWhatsappBySlugWithRole(slug, "agent");

  const messages = await db.query.messageTable.findMany({
    where: and(
      eq(messageTable.whatsappId, wa.id),
      eq(messageTable.chatId, chatId),
      isNotNull(messageTable.mediaUrl)
    ),
    orderBy: desc(messageTable.timestamp),
    columns: {
      id: true,
      mediaUrl: true,
      messageType: true,
      fileName: true,
      timestamp: true,
      mediaRetentionUntil: true,
    },
  });

  return messages.map((msg) => ({
    messageId: msg.id,
    url: msg.mediaUrl!,
    type: msg.messageType,
    fileName: msg.fileName,
    timestamp: msg.timestamp,
    retentionUntil: msg.mediaRetentionUntil,
  }));
}

export async function getChatNotes(
  slug: string,
  chatId: string
): Promise<ChatNote[]> {
  const { wa, user, role } = await getWhatsappBySlugWithRole(slug, "agent");

  const notes = await db.query.chatNoteTable.findMany({
    where: and(
      eq(chatNoteTable.whatsappId, wa.id),
      eq(chatNoteTable.chatId, chatId)
    ),
    orderBy: desc(chatNoteTable.createdAt),
    with: {
      createdByUser: {
        columns: { name: true, id: true },
      },
    },
  });

  const isManagerOrHigher = hasMinimumRole(role, "manager");

  return notes.map((note) => ({
    id: note.id,
    content: note.content,
    createdAt: note.createdAt,
    createdByName: note.createdByUser?.name || "Unknown",
    createdById: note.createdBy,
    canDelete: isManagerOrHigher || note.createdBy === user.id,
  }));
}

export async function updateChatConfigAction(
  slug: string,
  chatId: string,
  config: {
    customName: string | null;
    cleanupExcluded: boolean;
    cleanupIncluded: boolean;
  }
) {
  const { wa } = await getWhatsappBySlugWithRole(slug, "agent");

  // Check if config exists
  const existing = await db.query.chatConfigTable.findFirst({
    where: and(
      eq(chatConfigTable.whatsappId, wa.id),
      eq(chatConfigTable.chatId, chatId)
    ),
  });

  if (existing) {
    await db
      .update(chatConfigTable)
      .set({
        customName: config.customName,
        cleanupExcluded: config.cleanupExcluded,
        cleanupIncluded: config.cleanupIncluded,
      })
      .where(eq(chatConfigTable.id, existing.id));
  } else {
    await db.insert(chatConfigTable).values({
      id: randomUUID(),
      whatsappId: wa.id,
      chatId: chatId,
      customName: config.customName,
      cleanupExcluded: config.cleanupExcluded,
      cleanupIncluded: config.cleanupIncluded,
    });
  }

  revalidatePath(`/whatsapp/${slug}/chats/${encodeURIComponent(chatId)}`);

  return { success: true };
}

export async function createNoteAction(
  slug: string,
  chatId: string,
  content: string
) {
  const { wa, user } = await getWhatsappBySlugWithRole(slug, "agent");

  await db.insert(chatNoteTable).values({
    id: randomUUID(),
    whatsappId: wa.id,
    chatId: chatId,
    content: content,
    createdBy: user.id,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  revalidatePath(`/whatsapp/${slug}/chats/${encodeURIComponent(chatId)}`);

  return { success: true };
}

export async function deleteNoteAction(
  slug: string,
  chatId: string,
  noteId: string
) {
  const { wa, user, role } = await getWhatsappBySlugWithRole(slug, "agent");

  const note = await db.query.chatNoteTable.findFirst({
    where: and(
      eq(chatNoteTable.id, noteId),
      eq(chatNoteTable.whatsappId, wa.id),
      eq(chatNoteTable.chatId, chatId)
    ),
  });

  if (!note) {
    throw new Error("Nota no encontrada");
  }

  // Check permission: managers/owners can delete any, others only their own
  const isManagerOrHigher = hasMinimumRole(role, "manager");
  if (!isManagerOrHigher && note.createdBy !== user.id) {
    throw new Error("No tienes permiso para eliminar esta nota");
  }

  await db.delete(chatNoteTable).where(eq(chatNoteTable.id, noteId));

  revalidatePath(`/whatsapp/${slug}/chats/${encodeURIComponent(chatId)}`);

  return { success: true };
}
