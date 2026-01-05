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
      let isClosed = false;

      const send = (data: any) => {
        if (isClosed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          // Controller already closed, ignore
          isClosed = true;
        }
      };

      const cleanup = () => {
        isClosed = true;
        whatsappEvents.off(`qr-${id}`, onQr);
        whatsappEvents.off(`status-${id}`, onStatus);
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
             cleanup();
             try {
               controller.close();
             } catch (e) {
               // Already closed
             }
         }
      };

      whatsappEvents.on(`qr-${id}`, onQr);
      whatsappEvents.on(`status-${id}`, onStatus);

      req.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch (e) {
          // Already closed
        }
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
