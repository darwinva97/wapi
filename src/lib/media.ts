import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";

// Base directory for media storage
const MEDIA_BASE_DIR = path.join(process.cwd(), "public", "media");

// Ensure media directory exists
export function ensureMediaDirectory(): void {
  if (!fs.existsSync(MEDIA_BASE_DIR)) {
    fs.mkdirSync(MEDIA_BASE_DIR, { recursive: true });
    console.log("[Media] Created media directory:", MEDIA_BASE_DIR);
  }
}

/**
 * Sanitize filename to prevent path traversal and ensure filesystem compatibility
 * Limits to 255 characters due to common filesystem limits (e.g., ext4, NTFS)
 */
export function safeFilename(filename: string): string {
  // Remove path components
  const basename = path.basename(filename);
  
  // Replace unsafe characters with underscores
  const safe = basename
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .substring(0, 255); // Filesystem limit
  
  return safe || "file";
}

/**
 * Get the storage path for a message's media file
 */
export function getMediaPathForMessage(
  whatsappId: string,
  messageId: string,
  fileName: string
): { relativePath: string; absolutePath: string } {
  const date = new Date();
  const dateFolder = date.toISOString().split("T")[0]; // YYYY-MM-DD
  
  const safeWhatsappId = safeFilename(whatsappId);
  const safeMessageId = safeFilename(messageId);
  const safeFileName = safeFilename(fileName);
  
  const relativePath = path.join(safeWhatsappId, dateFolder, `${safeMessageId}_${safeFileName}`);
  const absolutePath = path.join(MEDIA_BASE_DIR, relativePath);
  
  return { relativePath, absolutePath };
}

/**
 * Calculate SHA256 hash of buffer
 */
export function calculateSHA256(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Convert stream to buffer
 */
export async function streamToBuffer(stream: Readable): Promise<Buffer> {
  const chunks: Buffer[] = [];
  
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("error", (err) => reject(err));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
  });
}

export interface MediaMetadata {
  mimetype?: string;
  size?: number;
  duration?: number;
  width?: number;
  height?: number;
  fileName?: string;
  sha256?: string;
  // Location fields
  latitude?: number;
  longitude?: number;
  locationName?: string;
  locationAddress?: string;
}

export interface SaveMediaResult {
  url: string; // Public URL to access the file
  path: string; // Relative path from public/media
  absolutePath: string; // Absolute filesystem path
  metadata: MediaMetadata;
}

/**
 * Download and save media to filesystem
 * @param bufferOrStream - Media content as Buffer or Readable stream
 * @param suggestedFilename - Suggested filename (will be sanitized)
 * @param whatsappId - WhatsApp instance ID
 * @param messageId - Message ID
 * @param additionalMetadata - Additional metadata to store
 * @returns Object with URL, paths, and metadata
 */
export async function downloadAndSaveMedia(
  bufferOrStream: Buffer | Readable,
  suggestedFilename: string,
  whatsappId: string,
  messageId: string,
  additionalMetadata: Partial<MediaMetadata> = {}
): Promise<SaveMediaResult> {
  try {
    // Ensure base directory exists
    ensureMediaDirectory();
    
    // Convert stream to buffer if necessary
    let buffer: Buffer;
    if (Buffer.isBuffer(bufferOrStream)) {
      buffer = bufferOrStream;
    } else {
      buffer = await streamToBuffer(bufferOrStream);
    }
    
    // Get paths
    const { relativePath, absolutePath } = getMediaPathForMessage(
      whatsappId,
      messageId,
      suggestedFilename
    );
    
    // Ensure directory exists
    const dir = path.dirname(absolutePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write file
    fs.writeFileSync(absolutePath, buffer);
    
    // Calculate metadata
    const metadata: MediaMetadata = {
      ...additionalMetadata,
      size: buffer.length,
      sha256: calculateSHA256(buffer),
    };
    
    // Public URL (Next.js serves from /public as /)
    // Normalize path separators to forward slashes for URLs
    const normalizedPath = relativePath.split(path.sep).join('/');
    const url = `/media/${normalizedPath}`;
    
    console.log("[Media] Saved media file:", { url, size: metadata.size });
    
    return {
      url,
      path: relativePath,
      absolutePath,
      metadata,
    };
  } catch (error) {
    console.error("[Media] Error saving media:", error);
    throw error;
  }
}
