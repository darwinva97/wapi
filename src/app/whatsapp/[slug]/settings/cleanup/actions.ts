"use server";

import { db } from "@/db";
import { whatsappCleanupConfigTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getWhatsappBySlugWithRole } from "@/lib/auth-utils";

export async function getCleanupConfigAction(slug: string) {
  const { wa } = await getWhatsappBySlugWithRole(slug, "manager");

  try {
    const config = await db.query.whatsappCleanupConfigTable.findFirst({
      where: eq(whatsappCleanupConfigTable.whatsappId, wa.id),
    });

    return {
      cleanupEnabled: config?.cleanupEnabled ?? false,
      cleanupDays: config?.cleanupDays ?? 30,
      excludeChats: config?.excludeChats ?? [],
      includeOnlyChats: config?.includeOnlyChats ?? [],
      forceCleanup: config?.forceCleanup ?? false,
      maxAgentRetentionDays: config?.maxAgentRetentionDays ?? 90,
    };
  } catch {
    return {
      cleanupEnabled: false,
      cleanupDays: 30,
      excludeChats: [],
      includeOnlyChats: [],
      forceCleanup: false,
      maxAgentRetentionDays: 90,
    };
  }
}

export async function updateCleanupConfigAction(
  slug: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const { wa } = await getWhatsappBySlugWithRole(slug, "manager");

    const cleanupEnabled = formData.get("cleanupEnabled") === "on";
    const cleanupDays = parseInt(formData.get("cleanupDays") as string) || 30;
    const forceCleanup = formData.get("forceCleanup") === "on";
    const maxAgentRetentionDays =
      parseInt(formData.get("maxAgentRetentionDays") as string) || 90;

    // Parse chat lists from textarea (one per line)
    const excludeChatsStr = formData.get("excludeChats") as string;
    const includeOnlyChatsStr = formData.get("includeOnlyChats") as string;

    const excludeChats = excludeChatsStr
      ? excludeChatsStr
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    const includeOnlyChats = includeOnlyChatsStr
      ? includeOnlyChatsStr
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];

    const existing = await db.query.whatsappCleanupConfigTable.findFirst({
      where: eq(whatsappCleanupConfigTable.whatsappId, wa.id),
    });

    if (existing) {
      await db
        .update(whatsappCleanupConfigTable)
        .set({
          cleanupEnabled,
          cleanupDays,
          excludeChats,
          includeOnlyChats,
          forceCleanup,
          maxAgentRetentionDays,
        })
        .where(eq(whatsappCleanupConfigTable.whatsappId, wa.id));
    } else {
      await db.insert(whatsappCleanupConfigTable).values({
        whatsappId: wa.id,
        cleanupEnabled,
        cleanupDays,
        excludeChats,
        includeOnlyChats,
        forceCleanup,
        maxAgentRetentionDays,
      });
    }

    revalidatePath(`/whatsapp/${slug}/settings/cleanup`);
    return { success: true };
  } catch (error) {
    console.error("Error updating cleanup config:", error);
    return { success: false, error: "Error al actualizar configuración" };
  }
}
