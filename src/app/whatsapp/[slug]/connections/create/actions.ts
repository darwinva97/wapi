"use server";

import { db } from "@/db";
import { connectionTable } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { getWhatsappBySlugWithRole } from "@/lib/auth-utils";

export async function createConnectionAction(formData: FormData) {
  const whatsappSlug = formData.get("whatsappSlug") as string;
  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;
  const description = formData.get("description") as string;
  const receiverEnabled = formData.get("receiverEnabled") === "on";
  const senderEnabled = formData.get("senderEnabled") === "on";

  if (!whatsappSlug || !name || !slug) {
    throw new Error("Missing required fields");
  }

  // Require manager role to create connections
  const { wa } = await getWhatsappBySlugWithRole(whatsappSlug, "manager");

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
