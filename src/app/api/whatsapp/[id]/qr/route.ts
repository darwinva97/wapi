import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { whatsappEvents, getQr } from "@/lib/whatsapp";
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
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Verify ownership
  const wa = await db.query.whatsappTable.findFirst({
    where: and(
      eq(whatsappTable.id, id),
      eq(whatsappTable.userId, session.user.id)
    ),
  });

  if (!wa) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const send = (data: any) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      // Send initial QR if available
      const currentQr = getQr(id);
      if (currentQr) {
        send({ type: 'qr', qr: currentQr });
      }

      const onQr = (qr: string) => {
        send({ type: 'qr', qr });
      };
      
      const onStatus = (data: { status: string }) => {
         send({ type: 'status', status: data.status });
         if (data.status === 'open') {
             // Keep stream open for a moment or close it? 
             // Usually we want to close it so the client knows it's done.
             controller.close();
         }
      };

      whatsappEvents.on(`qr-${id}`, onQr);
      whatsappEvents.on(`status-${id}`, onStatus);

      req.signal.addEventListener("abort", () => {
        whatsappEvents.off(`qr-${id}`, onQr);
        whatsappEvents.off(`status-${id}`, onStatus);
      });
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
