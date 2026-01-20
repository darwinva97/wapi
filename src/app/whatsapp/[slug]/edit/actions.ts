"use server";

import { db } from "@/db";
import { whatsappTable } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWhatsappWithRole } from "@/lib/auth-utils";

export async function updateWhatsappAction(id: string, formData: FormData) {
  // Require manager role to edit WhatsApp settings
  await getWhatsappWithRole(id, "manager");

  const description = formData.get("description") as string;
  const slug = formData.get("slug") as string;

  if (!slug) {
    throw new Error("Slug is required");
  }

  // Check if slug is unique (excluding current record)
  const existing = await db
    .select()
    .from(whatsappTable)
    .where(and(eq(whatsappTable.slug, slug), ne(whatsappTable.id, id)))
    .limit(1);

  if (existing.length > 0) {
    throw new Error("Slug already exists");
  }

  await db
    .update(whatsappTable)
    .set({
      description: description || null,
      slug,
    })
    .where(eq(whatsappTable.id, id));

  revalidatePath(`/whatsapp/${slug}`);
  redirect(`/whatsapp/${slug}`);
}
