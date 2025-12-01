"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { whatsappTable } from "@/db/schema";
import { headers } from "next/headers";
import { eq, and, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function updateWhatsappAction(id: string, formData: FormData) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  const description = formData.get("description") as string;
  const slug = formData.get("slug") as string;

  if (!slug) {
    throw new Error("Slug is required");
  }

  // Verify ownership
  const wa = await db.query.whatsappTable.findFirst({
    where: and(
      eq(whatsappTable.id, id),
      eq(whatsappTable.userId, session.user.id)
    ),
  });

  if (!wa) {
    throw new Error("WhatsApp account not found");
  }

  // Check if slug is unique (excluding current record)
  const existing = await db
    .select()
    .from(whatsappTable)
    .where(and(
      eq(whatsappTable.slug, slug),
      ne(whatsappTable.id, id)
    ))
    .limit(1);

  if (existing.length > 0) {
    throw new Error("Slug already exists");
  }

  await db.update(whatsappTable)
    .set({
      description: description || null,
      slug,
    })
    .where(eq(whatsappTable.id, id));

  revalidatePath(`/whatsapp/${slug}`);
  redirect(`/whatsapp/${slug}`);
}
