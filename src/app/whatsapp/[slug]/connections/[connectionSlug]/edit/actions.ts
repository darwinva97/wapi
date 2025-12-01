"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { whatsappTable, connectionTable } from "@/db/schema";
import { headers } from "next/headers";
import { eq, and, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";

export async function updateConnectionAction(id: string, formData: FormData) {
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

  // Verify connection exists and belongs to this whatsapp
  const connection = await db.query.connectionTable.findFirst({
    where: and(
      eq(connectionTable.id, id),
      eq(connectionTable.whatsappId, wa.id)
    ),
  });

  if (!connection) {
    throw new Error("Connection not found");
  }

  // Check if new slug is unique (excluding current connection)
  const existingConnection = await db.query.connectionTable.findFirst({
    where: and(
      eq(connectionTable.slug, slug),
      ne(connectionTable.id, id)
    ),
  });

  if (existingConnection) {
    throw new Error("Connection slug already exists");
  }

  // Handle token generation if sender is newly enabled
  let senderToken = connection.senderToken;
  if (senderEnabled && !connection.senderEnabled && !senderToken) {
    senderToken = randomUUID();
  }

  await db.update(connectionTable)
    .set({
      name,
      slug,
      description,
      receiverEnabled,
      senderEnabled,
      senderToken,
    })
    .where(eq(connectionTable.id, id));

  redirect(`/whatsapp/${whatsappSlug}/connections/${slug}`);
}
