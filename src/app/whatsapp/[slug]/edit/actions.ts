"use server";

import { db } from "@/db";
import { whatsappTable, whatsappMemberTable } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWhatsappWithRole, requireInstancePermission } from "@/lib/auth-utils";
import { disconnectWhatsApp } from "@/lib/whatsapp";
import fs from "fs";
import path from "path";

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

const SESSIONS_DIR = "whatsapp_sessions";

export async function deleteWhatsappAction(slug: string) {
  // Get the instance and verify owner permission
  const wa = await db.query.whatsappTable.findFirst({
    where: eq(whatsappTable.slug, slug),
  });

  if (!wa) {
    throw new Error("WhatsApp instance not found");
  }

  // Require delete_instance permission (only owners have this)
  await requireInstancePermission(wa.id, "delete_instance");

  // Disconnect the WhatsApp session if active
  await disconnectWhatsApp(wa.id);

  // Delete session files from disk
  const sessionPath = path.join(SESSIONS_DIR, wa.id);
  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true });
  }

  // Delete all members first (to avoid FK constraint issues)
  await db.delete(whatsappMemberTable).where(eq(whatsappMemberTable.whatsappId, wa.id));

  // Delete the WhatsApp instance (cascade will delete contacts, groups, messages, etc.)
  await db.delete(whatsappTable).where(eq(whatsappTable.id, wa.id));

  revalidatePath("/");
  redirect("/");
}
