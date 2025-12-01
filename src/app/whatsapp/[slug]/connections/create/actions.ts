"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { whatsappTable, connectionTable } from "@/db/schema";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";

export async function createConnectionAction(formData: FormData) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
  }

  const whatsappSlug = formData.get("whatsappSlug") as string;
  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;
  const description = formData.get("description") as string;
  const receiverEnabled = formData.get("receiverEnabled") === "on";
  const senderEnabled = formData.get("senderEnabled") === "on";

  if (!whatsappSlug || !name || !slug) {
    throw new Error("Missing required fields");
  }

  // Verify ownership of the WhatsApp account
  const wa = await db.query.whatsappTable.findFirst({
    where: and(
      eq(whatsappTable.slug, whatsappSlug),
      eq(whatsappTable.userId, session.user.id)
    ),
  });

  if (!wa) {
    throw new Error("WhatsApp account not found");
  }

  // Check if connection slug is unique
  const existingConnection = await db.query.connectionTable.findFirst({
    where: eq(connectionTable.slug, slug),
  });

  if (existingConnection) {
    throw new Error("Connection slug already exists");
  }

  await db.insert(connectionTable).values({
    id: randomUUID(),
    whatsappId: wa.id,
    name,
    slug,
    description,
    receiverEnabled,
    senderEnabled,
    // Initialize with defaults or nulls
    receiverRequest: null,
    receiverFilter: null,
    senderToken: senderEnabled ? randomUUID() : null, // Generate a token if sender is enabled
  });

  redirect(`/whatsapp/${whatsappSlug}`);
}
