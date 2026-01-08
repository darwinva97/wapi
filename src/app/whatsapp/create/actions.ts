"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { whatsappTable } from "@/db/schema";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

export async function createWhatsappAction(
  prevState: { success: boolean; error: string },
  formData: FormData
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { success: false, error: "No autorizado" };
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

    await db.insert(whatsappTable).values({
      id,
      userId: session.user.id,
      name,
      phoneNumber,
      description: description || null,
      slug,
      connected: false,
      enabled: true,
    });

    redirect(`/whatsapp/${slug}`);
  } catch (error) {
    console.error("Error creating WhatsApp:", error);
    return { success: false, error: "Error al crear WhatsApp. Intenta nuevamente." };
  }
}
