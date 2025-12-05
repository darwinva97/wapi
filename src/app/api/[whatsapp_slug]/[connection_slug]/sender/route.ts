import { db } from "@/db";
import { whatsappTable, connectionTable } from "@/db/schema";
import { getSocket } from "@/lib/whatsapp";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ whatsapp_slug: string; connection_slug: string }> }
) {
  const { whatsapp_slug, connection_slug } = await params;

  // 1. Validate Authorization Header
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing or invalid Authorization header" }, { status: 401 });
  }
  const token = authHeader.split(" ")[1];

  // 2. Find WhatsApp Account
  const wa = await db.query.whatsappTable.findFirst({
    where: eq(whatsappTable.slug, whatsapp_slug),
  });

  if (!wa) {
    return NextResponse.json({ error: "WhatsApp account not found" }, { status: 404 });
  }

  // 3. Find Connection
  const connection = await db.query.connectionTable.findFirst({
    where: and(
      eq(connectionTable.slug, connection_slug),
      eq(connectionTable.whatsappId, wa.id)
    ),
  });

  if (!connection) {
    return NextResponse.json({ error: "Connection not found" }, { status: 404 });
  }

  // 4. Verify Sender is Enabled and Token Matches
  if (!connection.senderEnabled) {
    return NextResponse.json({ error: "Sender is disabled for this connection" }, { status: 403 });
  }

  if (connection.senderToken !== token) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // 5. Get Baileys Socket
  const sock = getSocket(wa.id);
  if (!sock) {
    return NextResponse.json({ error: "WhatsApp is not connected" }, { status: 503 });
  }

  // 6. Parse Body and Send Message
  try {
    const body = await req.json();
    const { to, message } = body;

    if (!to || !message) {
      return NextResponse.json({ error: "Missing 'to' or 'message' in body" }, { status: 400 });
    }

    // Format JID (handle simple numbers)
    const jid = to.includes("@") ? to : `${to}@s.whatsapp.net`;

    const result = await sock.sendMessage(jid, message);

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Error sending message:", error);
    return NextResponse.json({ error: "Failed to send message", details: error.message }, { status: 500 });
  }
}
