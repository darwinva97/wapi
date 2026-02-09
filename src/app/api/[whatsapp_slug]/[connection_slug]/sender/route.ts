import { db } from "@/db";
import { whatsappTable, connectionTable } from "@/db/schema";
import { ELIXIR_API_URL } from "@/config/elixir";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

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

  // 5. Parse Body and Proxy to Elixir
  try {
    const body = await req.json();
    const { to, message } = body as { to: string; message: Record<string, unknown> };

    if (!to || !message) {
      return NextResponse.json({ error: "Missing 'to' or 'message' in body" }, { status: 400 });
    }

    const jid = to.includes("@") ? to : `${to}@s.whatsapp.net`;

    // Get session token to authenticate with Elixir backend
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("better-auth.session_token")?.value;

    const response = await fetch(`${ELIXIR_API_URL}/api/v1/sessions/${wa.id}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionToken ? { 'Authorization': `Bearer ${sessionToken}` } : {}),
      },
      body: JSON.stringify({ to: jid, message }),
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json({ error: error.error || "Failed to send message" }, { status: response.status });
    }

    const result = await response.json();
    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    console.error("Error sending message:", error);
    return NextResponse.json({ error: "Failed to send message", details: (error as Error).message }, { status: 500 });
  }
}
