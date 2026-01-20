"use server";

import { db } from "@/db";
import { platformConfigTable, userConfigTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth-utils";

export async function getPlatformConfigAction() {
  await requirePlatformAdmin();

  const config = await db.query.platformConfigTable.findFirst();

  return {
    allowRegistration: config?.allowRegistration ?? false,
    allowUserCreateWhatsapp: config?.allowUserCreateWhatsapp ?? true,
    defaultMaxWhatsappInstances: config?.defaultMaxWhatsappInstances ?? 0,
  };
}

export async function updatePlatformConfigAction(
  prevState: { success: boolean; error: string },
  formData: FormData
) {
  try {
    await requirePlatformAdmin();

    const allowRegistration = formData.get("allowRegistration") === "on";
    const allowUserCreateWhatsapp =
      formData.get("allowUserCreateWhatsapp") === "on";
    const defaultMaxWhatsappInstances = parseInt(
      formData.get("defaultMaxWhatsappInstances") as string
    ) || 0;

    const existing = await db.query.platformConfigTable.findFirst();

    if (existing) {
      await db
        .update(platformConfigTable)
        .set({
          allowRegistration,
          allowUserCreateWhatsapp,
          defaultMaxWhatsappInstances,
        })
        .where(eq(platformConfigTable.id, "default"));
    } else {
      await db.insert(platformConfigTable).values({
        id: "default",
        allowRegistration,
        allowUserCreateWhatsapp,
        defaultMaxWhatsappInstances,
      });
    }

    revalidatePath("/admin/platform");
    return { success: true, error: "" };
  } catch (error) {
    console.error("Error updating platform config:", error);
    return {
      success: false,
      error: "Error al actualizar la configuración",
    };
  }
}

export async function getUserConfigAction(userId: string) {
  await requirePlatformAdmin();

  const config = await db.query.userConfigTable.findFirst({
    where: eq(userConfigTable.userId, userId),
  });

  return {
    canCreateWhatsapp: config?.canCreateWhatsapp ?? null,
    maxWhatsappInstances: config?.maxWhatsappInstances ?? null,
  };
}

export async function updateUserConfigAction(
  userId: string,
  formData: FormData
) {
  try {
    await requirePlatformAdmin();

    const canCreateWhatsappValue = formData.get("canCreateWhatsapp") as string;
    const maxWhatsappInstancesValue = formData.get(
      "maxWhatsappInstances"
    ) as string;

    // Parse values - null means "use global"
    const canCreateWhatsapp =
      canCreateWhatsappValue === "null"
        ? null
        : canCreateWhatsappValue === "true";
    const maxWhatsappInstances =
      maxWhatsappInstancesValue === "null"
        ? null
        : parseInt(maxWhatsappInstancesValue) || 0;

    const existing = await db.query.userConfigTable.findFirst({
      where: eq(userConfigTable.userId, userId),
    });

    if (existing) {
      await db
        .update(userConfigTable)
        .set({
          canCreateWhatsapp,
          maxWhatsappInstances,
        })
        .where(eq(userConfigTable.userId, userId));
    } else {
      await db.insert(userConfigTable).values({
        id: crypto.randomUUID(),
        userId,
        canCreateWhatsapp,
        maxWhatsappInstances,
      });
    }

    revalidatePath("/admin/users");
    return { success: true, error: "" };
  } catch (error) {
    console.error("Error updating user config:", error);
    return {
      success: false,
      error: "Error al actualizar la configuración del usuario",
    };
  }
}
