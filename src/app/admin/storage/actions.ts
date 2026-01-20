"use server";

import { db } from "@/db";
import { storageConfigTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth-utils";
import { testS3Connection } from "@/lib/storage";

export async function getStorageConfigAction() {
  await requirePlatformAdmin();

  try {
    const config = await db.query.storageConfigTable.findFirst();
    return {
      storageType: config?.storageType ?? "local",
      s3Endpoint: config?.s3Endpoint ?? "",
      s3Bucket: config?.s3Bucket ?? "",
      s3Region: config?.s3Region ?? "",
      s3AccessKey: config?.s3AccessKey ? "********" : "", // Don't expose actual key
      s3SecretKey: config?.s3SecretKey ? "********" : "", // Don't expose actual key
      s3PublicUrl: config?.s3PublicUrl ?? "",
      hasCredentials: !!(config?.s3AccessKey && config?.s3SecretKey),
    };
  } catch {
    return {
      storageType: "local" as const,
      s3Endpoint: "",
      s3Bucket: "",
      s3Region: "",
      s3AccessKey: "",
      s3SecretKey: "",
      s3PublicUrl: "",
      hasCredentials: false,
    };
  }
}

export async function updateStorageConfigAction(
  prevState: { success: boolean; error: string },
  formData: FormData
) {
  try {
    await requirePlatformAdmin();

    const storageType = formData.get("storageType") as "local" | "s3";
    const s3Endpoint = formData.get("s3Endpoint") as string;
    const s3Bucket = formData.get("s3Bucket") as string;
    const s3Region = formData.get("s3Region") as string;
    const s3AccessKey = formData.get("s3AccessKey") as string;
    const s3SecretKey = formData.get("s3SecretKey") as string;
    const s3PublicUrl = formData.get("s3PublicUrl") as string;

    // Validate S3 config if storage type is s3
    if (storageType === "s3") {
      if (!s3Endpoint || !s3Bucket) {
        return {
          success: false,
          error: "Endpoint y Bucket son requeridos para S3",
        };
      }
    }

    const existing = await db.query.storageConfigTable.findFirst();

    // Prepare update data
    const updateData: {
      storageType: "local" | "s3";
      s3Endpoint: string | null;
      s3Bucket: string | null;
      s3Region: string | null;
      s3AccessKey?: string | null;
      s3SecretKey?: string | null;
      s3PublicUrl: string | null;
    } = {
      storageType,
      s3Endpoint: s3Endpoint || null,
      s3Bucket: s3Bucket || null,
      s3Region: s3Region || null,
      s3PublicUrl: s3PublicUrl || null,
    };

    // Only update credentials if new values are provided (not the masked "********")
    if (s3AccessKey && s3AccessKey !== "********") {
      updateData.s3AccessKey = s3AccessKey;
    }
    if (s3SecretKey && s3SecretKey !== "********") {
      updateData.s3SecretKey = s3SecretKey;
    }

    if (existing) {
      await db
        .update(storageConfigTable)
        .set(updateData)
        .where(eq(storageConfigTable.id, "default"));
    } else {
      await db.insert(storageConfigTable).values({
        id: "default",
        ...updateData,
        s3AccessKey: s3AccessKey !== "********" ? s3AccessKey || null : null,
        s3SecretKey: s3SecretKey !== "********" ? s3SecretKey || null : null,
      });
    }

    revalidatePath("/admin/storage");
    return { success: true, error: "" };
  } catch (error) {
    console.error("Error updating storage config:", error);
    return {
      success: false,
      error: "Error al actualizar la configuración de almacenamiento",
    };
  }
}

export async function testS3ConnectionAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await requirePlatformAdmin();

    const config = await db.query.storageConfigTable.findFirst();

    if (!config || config.storageType !== "s3") {
      return { success: false, error: "S3 no está configurado" };
    }

    if (!config.s3Endpoint || !config.s3Bucket) {
      return { success: false, error: "Configuración S3 incompleta" };
    }

    if (!config.s3AccessKey || !config.s3SecretKey) {
      return { success: false, error: "Credenciales S3 no configuradas" };
    }

    // Test actual S3 connection
    const result = await testS3Connection({
      storageType: "s3",
      s3Endpoint: config.s3Endpoint,
      s3Bucket: config.s3Bucket,
      s3Region: config.s3Region ?? undefined,
      s3AccessKey: config.s3AccessKey,
      s3SecretKey: config.s3SecretKey,
      s3PublicUrl: config.s3PublicUrl ?? undefined,
    });

    return result;
  } catch (error) {
    console.error("Error testing S3 connection:", error);
    return { success: false, error: "Error al probar conexión S3" };
  }
}
