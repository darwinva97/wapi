"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { whatsappTable } from "@/db/schema";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

export async function createWhatsappAction(formData: FormData) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  const name = formData.get("name") as string;
  const phoneNumber = formData.get("phoneNumber") as string;
  const description = formData.get("description") as string;
  const slug = formData.get("slug") as string;

  if (!name || !phoneNumber || !slug) {
    throw new Error("Name, Phone Number and Slug are required");
  }

  // Check if slug is unique
  const existing = await db
    .select()
    .from(whatsappTable)
    .where(eq(whatsappTable.slug, slug))
    .limit(1);

  if (existing.length > 0) {
    throw new Error("Slug already exists");
  }

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
}
