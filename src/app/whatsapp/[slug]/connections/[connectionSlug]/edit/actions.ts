"use server";

import { db } from "@/db";
import { connectionTable } from "@/db/schema";
import { eq, and, ne } from "drizzle-orm";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { getWhatsappBySlugWithRole } from "@/lib/auth-utils";

export async function updateConnectionAction(id: string, formData: FormData) {
  const whatsappSlug = formData.get("whatsappSlug") as string;
  const name = formData.get("name") as string;
  const slug = formData.get("slug") as string;
  const description = formData.get("description") as string;
  const receiverEnabled = formData.get("receiverEnabled") === "on";
  const senderEnabled = formData.get("senderEnabled") === "on";

  const receiverRequestStr = formData.get("receiverRequest") as string;
  const receiverFilterStr = formData.get("receiverFilter") as string;

  let receiverRequest = null;
  let receiverFilter = null;

  if (receiverRequestStr && receiverRequestStr.trim() !== "") {
    try {
      receiverRequest = JSON.parse(receiverRequestStr);
    } catch {
      throw new Error("Invalid JSON for Receiver Request Config");
    }
  }

  if (receiverFilterStr && receiverFilterStr.trim() !== "") {
    try {
      receiverFilter = JSON.parse(receiverFilterStr);
    } catch {
      throw new Error("Invalid JSON for Receiver Filter");
    }
  }

  if (!whatsappSlug || !name || !slug) {
    throw new Error("Missing required fields");
  }

  // Require manager role to edit connections
  const { wa } = await getWhatsappBySlugWithRole(whatsappSlug, "manager");

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
    where: and(eq(connectionTable.slug, slug), ne(connectionTable.id, id)),
  });

  if (existingConnection) {
    throw new Error("Connection slug already exists");
  }

  // Handle token generation if sender is newly enabled
  let senderToken = connection.senderToken;
  if (senderEnabled && !connection.senderEnabled && !senderToken) {
    senderToken = randomUUID();
  }

  await db
    .update(connectionTable)
    .set({
      name,
      slug,
      description,
      receiverEnabled,
      receiverRequest,
      receiverFilter,
      senderEnabled,
      senderToken,
    })
    .where(eq(connectionTable.id, id));

  redirect(`/whatsapp/${whatsappSlug}/connections/${slug}`);
}
