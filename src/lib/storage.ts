import { db } from "@/db";
import { storageConfigTable } from "@/db/schema";
import * as fs from "fs/promises";
import * as path from "path";
import { randomUUID } from "crypto";
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3";

export type StorageType = "local" | "s3";

export interface StorageConfig {
  storageType: StorageType;
  s3Endpoint?: string;
  s3Bucket?: string;
  s3Region?: string;
  s3AccessKey?: string;
  s3SecretKey?: string;
  s3PublicUrl?: string;
}

export interface UploadResult {
  success: boolean;
  url?: string;
  error?: string;
}

/**
 * Get current storage configuration
 */
export async function getStorageConfig(): Promise<StorageConfig> {
  try {
    const config = await db.query.storageConfigTable.findFirst();
    return {
      storageType: config?.storageType ?? "local",
      s3Endpoint: config?.s3Endpoint ?? undefined,
      s3Bucket: config?.s3Bucket ?? undefined,
      s3Region: config?.s3Region ?? undefined,
      s3AccessKey: config?.s3AccessKey ?? undefined,
      s3SecretKey: config?.s3SecretKey ?? undefined,
      s3PublicUrl: config?.s3PublicUrl ?? undefined,
    };
  } catch {
    return { storageType: "local" };
  }
}

/**
 * Save a file to storage (local or S3)
 */
export async function saveFile(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  whatsappId: string
): Promise<UploadResult> {
  const config = await getStorageConfig();

  if (config.storageType === "s3") {
    return saveFileToS3(buffer, filename, mimeType, whatsappId, config);
  } else {
    return saveFileToLocal(buffer, filename, mimeType, whatsappId);
  }
}

/**
 * Save file to local storage
 */
async function saveFileToLocal(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  whatsappId: string
): Promise<UploadResult> {
  try {
    // Generate unique filename
    const ext = getExtensionFromMime(mimeType) || path.extname(filename) || "";
    const uniqueFilename = `${randomUUID()}${ext}`;

    // Create directory structure: public/media/{whatsappId}/{date}/
    const today = new Date().toISOString().split("T")[0];
    const relativePath = `media/${whatsappId}/${today}`;
    const absolutePath = path.join(process.cwd(), "public", relativePath);

    // Ensure directory exists
    await fs.mkdir(absolutePath, { recursive: true });

    // Write file
    const filePath = path.join(absolutePath, uniqueFilename);
    await fs.writeFile(filePath, buffer);

    // Return public URL (relative path)
    const url = `/${relativePath}/${uniqueFilename}`;

    return { success: true, url };
  } catch (error) {
    console.error("Error saving file to local storage:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Create S3 client for Backblaze B2 or other S3-compatible storage
 */
function createS3Client(config: StorageConfig): S3Client {
  return new S3Client({
    endpoint: config.s3Endpoint,
    region: config.s3Region || "auto",
    credentials: {
      accessKeyId: config.s3AccessKey!,
      secretAccessKey: config.s3SecretKey!,
    },
    // Required for Backblaze B2
    forcePathStyle: true,
  });
}

/**
 * Save file to S3-compatible storage (Backblaze B2, AWS S3, MinIO, etc.)
 */
async function saveFileToS3(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  whatsappId: string,
  config: StorageConfig
): Promise<UploadResult> {
  try {
    const client = createS3Client(config);

    const ext = getExtensionFromMime(mimeType) || path.extname(filename) || "";
    const today = new Date().toISOString().split("T")[0];
    const key = `${whatsappId}/${today}/${randomUUID()}${ext}`;

    const command = new PutObjectCommand({
      Bucket: config.s3Bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    });

    await client.send(command);

    // Return public URL
    // For Backblaze B2: use s3PublicUrl if set (friendly URL), otherwise construct from endpoint
    let url: string;
    if (config.s3PublicUrl) {
      // Remove trailing slash if present
      const baseUrl = config.s3PublicUrl.replace(/\/$/, "");
      url = `${baseUrl}/${key}`;
    } else {
      // Construct URL from endpoint (for B2: https://s3.region.backblazeb2.com/bucket/key)
      const endpoint = config.s3Endpoint?.replace(/\/$/, "");
      url = `${endpoint}/${config.s3Bucket}/${key}`;
    }

    console.log(`[Storage] Uploaded to S3: ${key}`);
    return { success: true, url };
  } catch (error) {
    console.error("[Storage] S3 upload error:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Delete a file from storage
 */
export async function deleteFile(url: string): Promise<boolean> {
  const config = await getStorageConfig();

  if (config.storageType === "s3") {
    return deleteFileFromS3(url, config);
  } else {
    return deleteFileFromLocal(url);
  }
}

/**
 * Delete file from local storage
 */
async function deleteFileFromLocal(url: string): Promise<boolean> {
  try {
    // URL is like /media/whatsappId/date/filename
    const filePath = path.join(process.cwd(), "public", url);
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    console.error("Error deleting local file:", error);
    return false;
  }
}

/**
 * Extract S3 key from URL
 */
function extractKeyFromUrl(url: string, config: StorageConfig): string | null {
  try {
    // Try to extract key from public URL
    if (config.s3PublicUrl) {
      const baseUrl = config.s3PublicUrl.replace(/\/$/, "");
      if (url.startsWith(baseUrl)) {
        return url.substring(baseUrl.length + 1);
      }
    }

    // Try to extract from endpoint URL (https://endpoint/bucket/key)
    if (config.s3Endpoint && config.s3Bucket) {
      const endpoint = config.s3Endpoint.replace(/\/$/, "");
      const prefix = `${endpoint}/${config.s3Bucket}/`;
      if (url.startsWith(prefix)) {
        return url.substring(prefix.length);
      }
    }

    // Try URL parsing
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/").filter(Boolean);

    // If path includes bucket name, skip it
    if (pathParts[0] === config.s3Bucket) {
      return pathParts.slice(1).join("/");
    }

    return pathParts.join("/");
  } catch {
    console.error("[Storage] Failed to extract key from URL:", url);
    return null;
  }
}

/**
 * Delete file from S3-compatible storage
 */
async function deleteFileFromS3(
  url: string,
  config: StorageConfig
): Promise<boolean> {
  try {
    const key = extractKeyFromUrl(url, config);
    if (!key) {
      console.error("[Storage] Could not extract S3 key from URL:", url);
      return false;
    }

    const client = createS3Client(config);

    const command = new DeleteObjectCommand({
      Bucket: config.s3Bucket,
      Key: key,
    });

    await client.send(command);
    console.log(`[Storage] Deleted from S3: ${key}`);
    return true;
  } catch (error) {
    console.error("[Storage] S3 delete error:", error);
    return false;
  }
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMime(mimeType: string): string {
  const mimeToExt: Record<string, string> = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "video/mp4": ".mp4",
    "video/webm": ".webm",
    "audio/ogg": ".ogg",
    "audio/mpeg": ".mp3",
    "audio/wav": ".wav",
    "audio/mp4": ".m4a",
    "application/pdf": ".pdf",
    "application/msword": ".doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      ".docx",
    "application/vnd.ms-excel": ".xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
      ".xlsx",
    "text/plain": ".txt",
  };

  return mimeToExt[mimeType] || "";
}

/**
 * Check if S3 is properly configured
 */
export async function isS3Configured(): Promise<boolean> {
  const config = await getStorageConfig();

  if (config.storageType !== "s3") {
    return false;
  }

  return !!(
    config.s3Endpoint &&
    config.s3Bucket &&
    config.s3AccessKey &&
    config.s3SecretKey
  );
}

/**
 * Test S3 connection by checking if bucket exists and is accessible
 */
export async function testS3Connection(config: StorageConfig): Promise<{
  success: boolean;
  error?: string;
}> {
  if (
    !config.s3Endpoint ||
    !config.s3Bucket ||
    !config.s3AccessKey ||
    !config.s3SecretKey
  ) {
    return { success: false, error: "Missing required S3 configuration" };
  }

  try {
    const client = createS3Client(config);

    const command = new HeadBucketCommand({
      Bucket: config.s3Bucket,
    });

    await client.send(command);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[Storage] S3 connection test failed:", errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Delete file from S3 by key (used by cleanup job)
 */
export async function deleteS3FileByKey(key: string): Promise<boolean> {
  const config = await getStorageConfig();

  if (config.storageType !== "s3") {
    return false;
  }

  try {
    const client = createS3Client(config);

    const command = new DeleteObjectCommand({
      Bucket: config.s3Bucket,
      Key: key,
    });

    await client.send(command);
    console.log(`[Storage] Deleted from S3: ${key}`);
    return true;
  } catch (error) {
    console.error("[Storage] S3 delete error:", error);
    return false;
  }
}
