import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { getSocket } from "@/lib/whatsapp";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { whatsappTable } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify ownership
  const wa = await db.query.whatsappTable.findFirst({
    where: and(
      eq(whatsappTable.id, id),
      eq(whatsappTable.userId, session.user.id)
    ),
  });

  if (!wa) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const jid = req.nextUrl.searchParams.get("jid");
  if (!jid) {
    return NextResponse.json(
      { error: "Missing jid query parameter" },
      { status: 400 }
    );
  }

  const sock = getSocket(id);
  if (!sock) {
    return NextResponse.json(
      { error: "WhatsApp instance not connected" },
      { status: 503 }
    );
  }

  let url: string | null = null;
  try {
    const result = await sock.profilePictureUrl(jid, "preview");
    url = result ?? null;
  } catch {
    // profilePictureUrl throws when there is no profile picture set
    url = null;
  }

  return NextResponse.json(
    { url },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}
