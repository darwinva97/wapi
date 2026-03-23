"use server";

import { db } from "@/db";
import {
  messageTable,
  whatsappCleanupConfigTable,
  whatsappMemberTable,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  requireAuth,
  getInstanceRole,
  hasMinimumRole,
  type WhatsappMemberRole,
} from "./auth-utils";

/**
 * Set retention for a specific message's media
 */
export async function setMessageRetentionAction(
  whatsappId: string,
  messageId: string,
  retentionDays: number | null,
  slug: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();

    // Get user's role in this instance
    const role = await getInstanceRole(whatsappId, user.id);
    const isAdmin = user.role === "admin";

    if (!role && !isAdmin) {
      return { success: false, error: "No tienes acceso a esta instancia" };
    }

    const effectiveRole: WhatsappMemberRole = isAdmin ? "owner" : role!;

    // Verify message exists and belongs to this whatsapp
    const message = await db.query.messageTable.findFirst({
      where: and(
        eq(messageTable.id, messageId),
        eq(messageTable.whatsappId, whatsappId)
      ),
    });

    if (!message) {
      return { success: false, error: "Mensaje no encontrado" };
    }

    // If user is agent, check retention limit
    if (effectiveRole === "agent" && retentionDays !== null) {
      const cleanupConfig = await db.query.whatsappCleanupConfigTable.findFirst({
        where: eq(whatsappCleanupConfigTable.whatsappId, whatsappId),
      });

      const maxDays = cleanupConfig?.maxAgentRetentionDays ?? 90;

      if (retentionDays > maxDays) {
        return {
          success: false,
          error: `Los agentes solo pueden configurar hasta ${maxDays} días de retención`,
        };
      }
    }

    // Calculate retention date
    const retentionUntil = retentionDays
      ? new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000)
      : null;

    // Update message
    await db
      .update(messageTable)
      .set({
        mediaRetentionUntil: retentionUntil,
        mediaRetentionSetBy: user.id,
      })
      .where(eq(messageTable.id, messageId));

    revalidatePath(`/whatsapp/${slug}`);
    return { success: true };
  } catch (error) {
    console.error("Error setting message retention:", error);
    return { success: false, error: "Error al configurar retención" };
  }
}

/**
 * Remove retention from a message (use global policy)
 */
export async function removeMessageRetentionAction(
  whatsappId: string,
  messageId: string,
  slug: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await requireAuth();

    // Get user's role in this instance
    const role = await getInstanceRole(whatsappId, user.id);
    const isAdmin = user.role === "admin";

    if (!role && !isAdmin) {
      return { success: false, error: "No tienes acceso a esta instancia" };
    }

    // Get current retention info
    const message = await db.query.messageTable.findFirst({
      where: and(
        eq(messageTable.id, messageId),
        eq(messageTable.whatsappId, whatsappId)
      ),
    });

    if (!message) {
      return { success: false, error: "Mensaje no encontrado" };
    }

    // Check if user can remove this retention
    // Agents can only remove their own retention settings
    // Managers and owners can remove anyone's
    const effectiveRole: WhatsappMemberRole = isAdmin ? "owner" : role!;

    if (
      effectiveRole === "agent" &&
      message.mediaRetentionSetBy !== user.id
    ) {
      return {
        success: false,
        error: "Solo puedes eliminar retenciones configuradas por ti",
      };
    }

    // Remove retention
    await db
      .update(messageTable)
      .set({
        mediaRetentionUntil: null,
        mediaRetentionSetBy: null,
      })
      .where(eq(messageTable.id, messageId));

    revalidatePath(`/whatsapp/${slug}`);
    return { success: true };
  } catch (error) {
    console.error("Error removing message retention:", error);
    return { success: false, error: "Error al eliminar retención" };
  }
}

/**
 * Get message retention info
 */
export async function getMessageRetentionAction(
  whatsappId: string,
  messageId: string
): Promise<{
  hasRetention: boolean;
  retentionUntil: Date | null;
  setBy: string | null;
  canModify: boolean;
}> {
  try {
    const user = await requireAuth();

    const message = await db.query.messageTable.findFirst({
      where: and(
        eq(messageTable.id, messageId),
        eq(messageTable.whatsappId, whatsappId)
      ),
    });

    if (!message) {
      return {
        hasRetention: false,
        retentionUntil: null,
        setBy: null,
        canModify: false,
      };
    }

    // Get user's role
    const role = await getInstanceRole(whatsappId, user.id);
    const isAdmin = user.role === "admin";
    const effectiveRole: WhatsappMemberRole | null = isAdmin ? "owner" : role;

    // Determine if user can modify this retention
    let canModify = false;
    if (effectiveRole) {
      if (hasMinimumRole(effectiveRole, "manager")) {
        canModify = true;
      } else if (effectiveRole === "agent") {
        // Agents can only modify their own or set new
        canModify =
          !message.mediaRetentionSetBy ||
          message.mediaRetentionSetBy === user.id;
      }
    }

    return {
      hasRetention: !!message.mediaRetentionUntil,
      retentionUntil: message.mediaRetentionUntil,
      setBy: message.mediaRetentionSetBy,
      canModify,
    };
  } catch {
    return {
      hasRetention: false,
      retentionUntil: null,
      setBy: null,
      canModify: false,
    };
  }
}
