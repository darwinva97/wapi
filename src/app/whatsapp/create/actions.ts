"use server";

import { db } from "@/db";
import { whatsappTable, whatsappMemberTable } from "@/db/schema";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireAuth, canCreateWhatsapp } from "@/lib/auth-utils";

export async function createWhatsappAction(
  prevState: { success: boolean; error: string },
  formData: FormData
) {
  const user = await requireAuth();

  // Check if user can create WhatsApp instances
  const canCreate = await canCreateWhatsapp(user.id);
  if (!canCreate) {
    return {
      success: false,
      error: "No tienes permiso para crear más instancias de WhatsApp",
    };
  }

  const name = formData.get("name") as string;
  const phoneNumber = formData.get("phoneNumber") as string;
  const description = formData.get("description") as string;
  const slug = formData.get("slug") as string;

  if (!name || !phoneNumber || !slug) {
    return { success: false, error: "Nombre, teléfono y slug son requeridos" };
  }

  // Check if slug is unique
  const existing = await db
    .select()
    .from(whatsappTable)
    .where(eq(whatsappTable.slug, slug))
    .limit(1);

  if (existing.length > 0) {
    return { success: false, error: "El slug ya está en uso" };
  }

  try {
    const id = crypto.randomUUID();

    // Create WhatsApp instance
    await db.insert(whatsappTable).values({
      id,
      userId: user.id,
      name,
      phoneNumber,
      description: description || null,
      slug,
      connected: false,
      enabled: true,
    });

    // Create owner member record for the creator
    await db.insert(whatsappMemberTable).values({
      id: crypto.randomUUID(),
      whatsappId: id,
      userId: user.id,
      role: "owner",
      createdBy: user.id,
    });

    redirect(`/whatsapp/${slug}`);
  } catch (error) {
    // Re-throw redirect/notFound errors (Next.js uses exceptions for navigation)
    const digest = (error as { digest?: string })?.digest;
    if (digest?.startsWith("NEXT_REDIRECT") || digest?.startsWith("NEXT_NOT_FOUND")) {
      throw error;
    }
    console.error("Error creating WhatsApp:", error);
    return {
      success: false,
      error: "Error al crear WhatsApp. Intenta nuevamente.",
    };
  }
}
