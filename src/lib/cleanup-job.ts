import { db } from "@/db";
import {
  messageTable,
  whatsappCleanupConfigTable,
  chatConfigTable,
  storageConfigTable,
} from "@/db/schema";
import { eq, and, lt, isNotNull, sql } from "drizzle-orm";
import * as fs from "fs/promises";
import * as path from "path";
import { deleteFile } from "./storage";

export interface CleanupResult {
  whatsappId: string;
  messagesProcessed: number;
  filesDeleted: number;
  bytesFreed: number;
  errors: string[];
}

export interface CleanupSummary {
  startedAt: Date;
  completedAt: Date;
  totalMessagesProcessed: number;
  totalFilesDeleted: number;
  totalBytesFreed: number;
  results: CleanupResult[];
  errors: string[];
}

/**
 * Run cleanup for all WhatsApp instances with cleanup enabled
 */
export async function runCleanupJob(): Promise<CleanupSummary> {
  const startedAt = new Date();
  const summary: CleanupSummary = {
    startedAt,
    completedAt: startedAt,
    totalMessagesProcessed: 0,
    totalFilesDeleted: 0,
    totalBytesFreed: 0,
    results: [],
    errors: [],
  };

  try {
    // Get storage config
    const storageConfig = await db.query.storageConfigTable.findFirst();
    const isLocalStorage = !storageConfig || storageConfig.storageType === "local";

    // Get all cleanup configs that are enabled
    const cleanupConfigs = await db.query.whatsappCleanupConfigTable.findMany({
      where: eq(whatsappCleanupConfigTable.cleanupEnabled, true),
    });

    console.log(`[Cleanup] Starting cleanup for ${cleanupConfigs.length} instances`);

    for (const config of cleanupConfigs) {
      try {
        const result = await cleanupWhatsappInstance(config, isLocalStorage);
        summary.results.push(result);
        summary.totalMessagesProcessed += result.messagesProcessed;
        summary.totalFilesDeleted += result.filesDeleted;
        summary.totalBytesFreed += result.bytesFreed;
      } catch (error) {
        const errorMsg = `Error cleaning ${config.whatsappId}: ${error}`;
        console.error(`[Cleanup] ${errorMsg}`);
        summary.errors.push(errorMsg);
      }
    }
  } catch (error) {
    const errorMsg = `Fatal cleanup error: ${error}`;
    console.error(`[Cleanup] ${errorMsg}`);
    summary.errors.push(errorMsg);
  }

  summary.completedAt = new Date();
  console.log(
    `[Cleanup] Completed. Files deleted: ${summary.totalFilesDeleted}, Bytes freed: ${summary.totalBytesFreed}`
  );

  return summary;
}

/**
 * Cleanup a single WhatsApp instance
 */
async function cleanupWhatsappInstance(
  config: {
    whatsappId: string;
    cleanupDays: number;
    excludeChats: string[] | null;
    includeOnlyChats: string[] | null;
    forceCleanup: boolean;
  },
  isLocalStorage: boolean
): Promise<CleanupResult> {
  const result: CleanupResult = {
    whatsappId: config.whatsappId,
    messagesProcessed: 0,
    filesDeleted: 0,
    bytesFreed: 0,
    errors: [],
  };

  const cutoffDate = new Date(
    Date.now() - config.cleanupDays * 24 * 60 * 60 * 1000
  );

  console.log(
    `[Cleanup] Processing ${config.whatsappId}, cutoff: ${cutoffDate.toISOString()}`
  );

  // Build query conditions
  const conditions = [
    eq(messageTable.whatsappId, config.whatsappId),
    lt(messageTable.timestamp, cutoffDate),
    isNotNull(messageTable.mediaUrl),
  ];

  // Add retention filter (unless force cleanup)
  if (!config.forceCleanup) {
    // Exclude messages with retention set to future date
    conditions.push(
      sql`(${messageTable.mediaRetentionUntil} IS NULL OR ${messageTable.mediaRetentionUntil} < ${Date.now()})`
    );
  }

  // Get chat configs for this instance
  const chatConfigs = await db.query.chatConfigTable.findMany({
    where: eq(chatConfigTable.whatsappId, config.whatsappId),
  });

  // Build excluded chats list
  const excludedChats = new Set<string>(config.excludeChats ?? []);
  chatConfigs
    .filter((c) => c.cleanupExcluded)
    .forEach((c) => excludedChats.add(c.chatId));

  // Build included-only chats list
  let includedOnlyChats: Set<string> | null = null;
  if (config.includeOnlyChats && config.includeOnlyChats.length > 0) {
    includedOnlyChats = new Set(config.includeOnlyChats);
    // Also add chat configs marked as cleanup_included
    chatConfigs
      .filter((c) => c.cleanupIncluded)
      .forEach((c) => includedOnlyChats!.add(c.chatId));
  }

  // Get messages to clean
  let messages = await db.query.messageTable.findMany({
    where: and(...conditions),
  });

  // Apply chat filters
  if (includedOnlyChats && includedOnlyChats.size > 0) {
    messages = messages.filter((m) => includedOnlyChats!.has(m.chatId));
  } else if (excludedChats.size > 0) {
    messages = messages.filter((m) => !excludedChats.has(m.chatId));
  }

  console.log(`[Cleanup] Found ${messages.length} messages to clean`);

  // Process messages
  for (const message of messages) {
    result.messagesProcessed++;

    if (!message.mediaUrl) continue;

    try {
      // Delete file
      if (isLocalStorage) {
        const filePath = path.join(process.cwd(), "public", message.mediaUrl);
        try {
          const stats = await fs.stat(filePath);
          result.bytesFreed += stats.size;
          await fs.unlink(filePath);
          result.filesDeleted++;
        } catch (err) {
          // File might not exist
          if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
            result.errors.push(`Failed to delete ${filePath}: ${err}`);
          }
        }
      } else {
        // S3 deletion
        const deleted = await deleteFile(message.mediaUrl);
        if (deleted) {
          result.filesDeleted++;
          // Note: We can't easily get file size from S3 without an extra request
          // so bytesFreed won't be accurate for S3
        } else {
          result.errors.push(`Failed to delete S3 file: ${message.mediaUrl}`);
        }
      }

      // Update message to remove media reference
      await db
        .update(messageTable)
        .set({
          mediaUrl: null,
          mediaMetadata: null,
        })
        .where(eq(messageTable.id, message.id));
    } catch (error) {
      result.errors.push(`Error processing message ${message.id}: ${error}`);
    }
  }

  return result;
}

/**
 * Cleanup a specific chat's media
 */
export async function cleanupChat(
  whatsappId: string,
  chatId: string,
  daysOld: number
): Promise<CleanupResult> {
  const result: CleanupResult = {
    whatsappId,
    messagesProcessed: 0,
    filesDeleted: 0,
    bytesFreed: 0,
    errors: [],
  };

  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

  const messages = await db.query.messageTable.findMany({
    where: and(
      eq(messageTable.whatsappId, whatsappId),
      eq(messageTable.chatId, chatId),
      lt(messageTable.timestamp, cutoffDate),
      isNotNull(messageTable.mediaUrl)
    ),
  });

  const storageConfig = await db.query.storageConfigTable.findFirst();
  const isLocalStorage = !storageConfig || storageConfig.storageType === "local";

  for (const message of messages) {
    result.messagesProcessed++;

    if (!message.mediaUrl) continue;

    try {
      if (isLocalStorage) {
        const filePath = path.join(process.cwd(), "public", message.mediaUrl);
        try {
          const stats = await fs.stat(filePath);
          result.bytesFreed += stats.size;
          await fs.unlink(filePath);
          result.filesDeleted++;
        } catch {
          // File might not exist
        }
      } else {
        // S3 deletion
        const deleted = await deleteFile(message.mediaUrl);
        if (deleted) {
          result.filesDeleted++;
        }
      }

      await db
        .update(messageTable)
        .set({ mediaUrl: null, mediaMetadata: null })
        .where(eq(messageTable.id, message.id));
    } catch (error) {
      result.errors.push(`Error: ${error}`);
    }
  }

  return result;
}
