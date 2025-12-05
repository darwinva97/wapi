"use server";

import { auth } from "@/lib/auth";
import { db } from "@/db";
import { whatsappTable, connectionTable } from "@/db/schema";
import { headers } from "next/headers";
import { eq, and } from "drizzle-orm";
import { getSocket } from "@/lib/whatsapp";
import { revalidatePath } from "next/cache";

export async function testSenderAction(connectionId: string, to: string, message: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const connection = await db.query.connectionTable.findFirst({
    where: eq(connectionTable.id, connectionId),
  });
  
  // Fallback if relation not defined in schema (likely not defined yet based on previous context)
  let whatsappId = connection?.whatsappId;
  if (!connection) {
     return { success: false, error: "Connection not found" };
  }

  // Verify ownership via whatsapp
  const wa = await db.query.whatsappTable.findFirst({
    where: and(
        eq(whatsappTable.id, whatsappId!),
        eq(whatsappTable.userId, session.user.id)
    )
  });

  if (!wa) {
    return { success: false, error: "Unauthorized access to connection" };
  }

  if (!connection.senderEnabled) {
    return { success: false, error: "Sender is disabled" };
  }

  const sock = getSocket(wa.id);
  if (!sock) {
    if (wa.connected) {
      await db.update(whatsappTable)
        .set({ connected: false })
        .where(eq(whatsappTable.id, wa.id));
      revalidatePath(`/whatsapp/${wa.slug}`, 'layout');
    }
    return { success: false, error: "WhatsApp is not connected" };
  }

  try {
    const jid = to.includes("@") ? to : `${to}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text: message });
    return { success: true, message: "Message sent successfully" };
  } catch (error: any) {
    console.error("Test Sender Error:", error);
    return { success: false, error: error.message || "Failed to send message" };
  }
}

export async function testReceiverAction(connectionId: string) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return { success: false, error: "Unauthorized" };
  }

  const connection = await db.query.connectionTable.findFirst({
    where: eq(connectionTable.id, connectionId),
  });

  if (!connection) {
     return { success: false, error: "Connection not found" };
  }
  
  const wa = await db.query.whatsappTable.findFirst({
    where: and(
        eq(whatsappTable.id, connection.whatsappId),
        eq(whatsappTable.userId, session.user.id)
    )
  });

  if (!wa) {
    return { success: false, error: "Unauthorized access to connection" };
  }

  if (!connection.receiverEnabled) {
    return { success: false, error: "Receiver is disabled" };
  }

  const config = connection.receiverRequest as { url: string; headers?: Record<string, string> } | null;
  
  if (!config || !config.url) {
    return { success: false, error: "Receiver URL not configured" };
  }

  // Mock Payload
  const mockPayload = {
    messages: [
      {
        key: {
          remoteJid: "1234567890@s.whatsapp.net",
          fromMe: false,
          id: "TEST_MESSAGE_ID",
        },
        message: {
          conversation: "This is a test message from WAPI Dashboard",
        },
        messageTimestamp: Date.now() / 1000,
        pushName: "Test User",
      }
    ],
    type: "notify"
  };
  console.log("Testing Receiver with payload:", mockPayload, config.url);
  try {
    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...config.headers,
      },
      body: JSON.stringify(mockPayload),
    });

    const responseText = await response.text();
    
    return { 
      success: response.ok, 
      status: response.status,
      response: responseText.substring(0, 500) // Truncate if too long
    };
  } catch (error: any) {
    console.error("Test Receiver Error:", error);
    return { success: false, error: error.message || "Failed to call webhook" };
  }
}
