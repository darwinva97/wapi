"use server";

import { db } from "@/db";
import { whatsappMemberTable, userTable, whatsappTable } from "@/db/schema";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import {
  getWhatsappBySlugWithRole,
  canManageRole,
  canRemoveRole,
  type WhatsappMemberRole,
} from "@/lib/auth-utils";

export async function getMembersAction(slug: string) {
  const { wa } = await getWhatsappBySlugWithRole(slug, "agent");

  const members = await db.query.whatsappMemberTable.findMany({
    where: eq(whatsappMemberTable.whatsappId, wa.id),
    with: {
      user: true,
      createdByUser: true,
    },
  });

  return members.map((m) => ({
    id: m.id,
    role: m.role,
    createdAt: m.createdAt,
    user: {
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
    },
    createdBy: m.createdByUser
      ? {
          id: m.createdByUser.id,
          name: m.createdByUser.name,
        }
      : null,
  }));
}

export async function addMemberAction(
  slug: string,
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  try {
    const email = formData.get("email") as string;
    const role = formData.get("role") as WhatsappMemberRole;

    if (!email || !role) {
      return { success: false, error: "Email y rol son requeridos" };
    }

    // Validate role
    if (!["owner", "manager", "agent"].includes(role)) {
      return { success: false, error: "Rol inválido" };
    }

    // Get WhatsApp instance and verify user role
    const { wa, user, role: userRole } = await getWhatsappBySlugWithRole(
      slug,
      "manager"
    );

    // Check if user can assign this role
    if (!canManageRole(userRole, role)) {
      return {
        success: false,
        error: `No tienes permiso para asignar el rol ${role}`,
      };
    }

    // Find user by email
    const targetUser = await db.query.userTable.findFirst({
      where: eq(userTable.email, email),
    });

    if (!targetUser) {
      return {
        success: false,
        error: "No se encontró un usuario con ese email",
      };
    }

    // Check if user is already a member
    const existingMember = await db.query.whatsappMemberTable.findFirst({
      where: and(
        eq(whatsappMemberTable.whatsappId, wa.id),
        eq(whatsappMemberTable.userId, targetUser.id)
      ),
    });

    if (existingMember) {
      return {
        success: false,
        error: "El usuario ya es miembro de esta instancia",
      };
    }

    // Add member
    await db.insert(whatsappMemberTable).values({
      id: crypto.randomUUID(),
      whatsappId: wa.id,
      userId: targetUser.id,
      role,
      createdBy: user.id,
    });

    revalidatePath(`/whatsapp/${slug}/members`);
    return { success: true };
  } catch (error) {
    console.error("Error adding member:", error);
    return { success: false, error: "Error al agregar miembro" };
  }
}

export async function updateMemberRoleAction(
  slug: string,
  memberId: string,
  newRole: WhatsappMemberRole
): Promise<{ success: boolean; error?: string }> {
  try {
    // Validate role
    if (!["owner", "manager", "agent"].includes(newRole)) {
      return { success: false, error: "Rol inválido" };
    }

    // Get WhatsApp instance and verify user role
    const { wa, user, role: userRole } = await getWhatsappBySlugWithRole(
      slug,
      "manager"
    );

    // Get the member to update
    const member = await db.query.whatsappMemberTable.findFirst({
      where: and(
        eq(whatsappMemberTable.id, memberId),
        eq(whatsappMemberTable.whatsappId, wa.id)
      ),
    });

    if (!member) {
      return { success: false, error: "Miembro no encontrado" };
    }

    // Can't change your own role
    if (member.userId === user.id) {
      return { success: false, error: "No puedes cambiar tu propio rol" };
    }

    // Check if user can manage both the current and new role
    if (!canManageRole(userRole, member.role as WhatsappMemberRole)) {
      return {
        success: false,
        error: `No tienes permiso para modificar un ${member.role}`,
      };
    }

    if (!canManageRole(userRole, newRole)) {
      return {
        success: false,
        error: `No tienes permiso para asignar el rol ${newRole}`,
      };
    }

    // Update member role
    await db
      .update(whatsappMemberTable)
      .set({ role: newRole })
      .where(eq(whatsappMemberTable.id, memberId));

    revalidatePath(`/whatsapp/${slug}/members`);
    return { success: true };
  } catch (error) {
    console.error("Error updating member role:", error);
    return { success: false, error: "Error al actualizar el rol" };
  }
}

export async function removeMemberAction(
  slug: string,
  memberId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Get WhatsApp instance and verify user role
    const { wa, user, role: userRole } = await getWhatsappBySlugWithRole(
      slug,
      "manager"
    );

    // Get the member to remove
    const member = await db.query.whatsappMemberTable.findFirst({
      where: and(
        eq(whatsappMemberTable.id, memberId),
        eq(whatsappMemberTable.whatsappId, wa.id)
      ),
    });

    if (!member) {
      return { success: false, error: "Miembro no encontrado" };
    }

    // Can't remove yourself
    if (member.userId === user.id) {
      return { success: false, error: "No puedes eliminarte a ti mismo" };
    }

    // Check if user can remove this role
    if (!canRemoveRole(userRole, member.role as WhatsappMemberRole)) {
      return {
        success: false,
        error: `No tienes permiso para eliminar un ${member.role}`,
      };
    }

    // Prevent removing the last owner
    if (member.role === "owner") {
      const ownerCount = await db.query.whatsappMemberTable.findMany({
        where: and(
          eq(whatsappMemberTable.whatsappId, wa.id),
          eq(whatsappMemberTable.role, "owner")
        ),
      });

      if (ownerCount.length <= 1) {
        return {
          success: false,
          error: "No puedes eliminar al único propietario",
        };
      }
    }

    // Remove member
    await db
      .delete(whatsappMemberTable)
      .where(eq(whatsappMemberTable.id, memberId));

    revalidatePath(`/whatsapp/${slug}/members`);
    return { success: true };
  } catch (error) {
    console.error("Error removing member:", error);
    return { success: false, error: "Error al eliminar miembro" };
  }
}
