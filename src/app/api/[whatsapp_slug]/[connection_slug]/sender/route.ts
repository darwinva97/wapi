import { db } from "@/db";
import { whatsappTable, connectionTable, messageTable } from "@/db/schema";
import { getSocket } from "@/lib/whatsapp";
import { eq, and } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { isGroup } from "@/lib/whatsapp-utils";
import { saveFile } from "@/lib/storage";

interface MediaMessage {
  image?: { url: string };
  video?: { url: string };
  audio?: { url: string };
  document?: { url: string };
  sticker?: { url: string };
  caption?: string;
  fileName?: string;
  mimetype?: string;
  ptt?: boolean;
}

function detectMessageType(message: Record<string, unknown>): {
  type: 'text' | 'image' | 'video' | 'audio' | 'document' | 'sticker';
  hasMedia: boolean;
  mediaUrl?: string;
} {
  if (message.image && typeof message.image === 'object' && 'url' in (message.image as object)) {
    return { type: 'image', hasMedia: true, mediaUrl: (message.image as { url: string }).url };
  }
  if (message.video && typeof message.video === 'object' && 'url' in (message.video as object)) {
    return { type: 'video', hasMedia: true, mediaUrl: (message.video as { url: string }).url };
  }
  if (message.audio && typeof message.audio === 'object' && 'url' in (message.audio as object)) {
    return { type: 'audio', hasMedia: true, mediaUrl: (message.audio as { url: string }).url };
  }
  if (message.document && typeof message.document === 'object' && 'url' in (message.document as object)) {
    return { type: 'document', hasMedia: true, mediaUrl: (message.document as { url: string }).url };
  }
  if (message.sticker && typeof message.sticker === 'object' && 'url' in (message.sticker as object)) {
    return { type: 'sticker', hasMedia: true, mediaUrl: (message.sticker as { url: string }).url };
  }
  return { type: 'text', hasMedia: false };
}

async function downloadExternalMedia(url: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const buffer = Buffer.from(await response.arrayBuffer());
    const mimeType = response.headers.get('content-type') || 'application/octet-stream';

    return { buffer, mimeType };
  } catch (error) {
    console.error("Error downloading media from URL:", error);
    return null;
  }
}

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
    const { to, message } = body as { to: string; message: Record<string, unknown> };

    if (!to || !message) {
      return NextResponse.json({ error: "Missing 'to' or 'message' in body" }, { status: 400 });
    }

    // Format JID (handle simple numbers)
    const jid = to.includes("@") ? to : `${to}@s.whatsapp.net`;

    // Detect message type and check for media
    const { type: messageType, hasMedia, mediaUrl: externalMediaUrl } = detectMessageType(message);

    let localMediaUrl: string | null = null;
    let mediaMetadata: Record<string, unknown> | null = null;
    let processedMessage = message;

    // If message contains media with external URL, download and save locally
    if (hasMedia && externalMediaUrl) {
      const downloaded = await downloadExternalMedia(externalMediaUrl);

      if (downloaded) {
        const fileName = (message as MediaMessage).fileName || `${messageType}_${Date.now()}`;
        const saveResult = await saveFile(
          downloaded.buffer,
          fileName,
          downloaded.mimeType,
          wa.id
        );

        if (saveResult.success && saveResult.url) {
          localMediaUrl = saveResult.url;
          mediaMetadata = {
            mimetype: downloaded.mimeType,
            size: downloaded.buffer.length,
            fileName: fileName,
          };

          // Replace URL with buffer for Baileys and set mimetype
          processedMessage = { ...message, mimetype: downloaded.mimeType };
          if (messageType === 'image') {
            (processedMessage as Record<string, unknown>).image = downloaded.buffer;
          } else if (messageType === 'video') {
            (processedMessage as Record<string, unknown>).video = downloaded.buffer;
          } else if (messageType === 'audio') {
            (processedMessage as Record<string, unknown>).audio = downloaded.buffer;
          } else if (messageType === 'document') {
            (processedMessage as Record<string, unknown>).document = downloaded.buffer;
          } else if (messageType === 'sticker') {
            (processedMessage as Record<string, unknown>).sticker = downloaded.buffer;
          }
        }
      }
    }

    const result = await sock.sendMessage(jid, processedMessage as never);

    // Save message to database with connection tracking
    if (result?.key?.id) {
      const timestamp = new Date();
      const isGroupChat = isGroup(jid);

      // Extract body text
      let bodyText = '';
      if (message.text) {
        bodyText = message.text as string;
      } else if ((message as MediaMessage).caption) {
        bodyText = (message as MediaMessage).caption as string;
      }

      await db.insert(messageTable).values({
        id: result.key.id,
        whatsappId: wa.id,
        chatId: jid,
        chatType: isGroupChat ? 'group' : 'personal',
        senderId: sock.user?.id || jid,
        content: result,
        body: bodyText,
        timestamp: timestamp,
        fromMe: true,
        messageType: messageType,
        mediaUrl: localMediaUrl,
        mediaMetadata: mediaMetadata ? JSON.stringify(mediaMetadata) : null,
        fileName: (message as MediaMessage).fileName || null,
        ackStatus: 1, // SENT
        sentFromPlatform: true,
        sentByConnectionId: connection.id,
      }).onConflictDoNothing();
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    console.error("Error sending message:", error);
    return NextResponse.json({ error: "Failed to send message", details: (error as Error).message }, { status: 500 });
  }
}
