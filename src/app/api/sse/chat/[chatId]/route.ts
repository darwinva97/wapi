import { whatsappEvents } from "@/lib/whatsapp";
import { NextRequest } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  const { chatId } = await params;
  const decodedChatId = decodeURIComponent(chatId);

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      const sendEvent = (data: any) => {
        const text = `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(text));
      };

      const listener = (data: any) => {
        sendEvent(data);
      };

      const eventName = `new-message-${decodedChatId}`;
      whatsappEvents.on(eventName, listener);

      // Keep connection alive
      const interval = setInterval(() => {
        controller.enqueue(encoder.encode(": keep-alive\n\n"));
      }, 30000);

      request.signal.addEventListener("abort", () => {
        whatsappEvents.off(eventName, listener);
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
