"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { whatsappTable } from "@/db/schema";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { connectToWhatsApp, disconnectWhatsApp } from "@/lib/whatsapp";

export async function connectWhatsappAction(id: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
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

  // Initialize Baileys connection
  await connectToWhatsApp(id);
  
  revalidatePath(`/whatsapp/${wa.slug}`);
}

export async function disconnectWhatsappAction(id: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    throw new Error("Unauthorized");
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

  await disconnectWhatsApp(id);
  
  revalidatePath(`/whatsapp/${wa.slug}`);
}
