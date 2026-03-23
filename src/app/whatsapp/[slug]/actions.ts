"use server";

import { revalidatePath } from "next/cache";
import { connectToWhatsApp, disconnectWhatsApp, syncConnectionState } from "@/lib/whatsapp";
import { getWhatsappWithRole } from "@/lib/auth-utils";

export async function connectWhatsappAction(id: string) {
  // Verify user has at least manager role to connect/disconnect
  const { wa } = await getWhatsappWithRole(id, "manager");

  // Initialize Baileys connection
  await connectToWhatsApp(id);

  revalidatePath(`/whatsapp/${wa.slug}`);
}

export async function disconnectWhatsappAction(id: string) {
  // Verify user has at least manager role to connect/disconnect
  const { wa } = await getWhatsappWithRole(id, "manager");

  await disconnectWhatsApp(id);

  revalidatePath(`/whatsapp/${wa.slug}`);
}

// Action to sync and get real connection state
export async function syncConnectionStateAction(id: string): Promise<{
  isConnected: boolean;
  wasOutOfSync: boolean;
}> {
  // Any member can sync connection state (view permission)
  const { wa } = await getWhatsappWithRole(id, "agent");

  const result = await syncConnectionState(id);

  if (result.wasOutOfSync) {
    revalidatePath(`/whatsapp/${wa.slug}`);
  }

  return result;
}
