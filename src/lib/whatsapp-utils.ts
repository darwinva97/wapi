import type { Contact, proto } from "baileys";

export function extractMessageText(message: proto.IMessage | null | undefined): string {
  if (!message) return "";
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    ""
  );
}

export interface NormalizedContactData {
  id: string;
  lid: string | null;
  pn: string | null;
  contactName: string | null;
  notifyName: string | null;
  verifiedName: string | null;
  imgUrl: string | null;
  status: string | null;
}

export function normalizeContactData(contact: Contact | Partial<Contact>): NormalizedContactData {
  const id = contact.id || '';
  
  let lid: string | null = null;
  let pn: string | null = null;
  
  if (id.includes('@lid')) {
    lid = id;
  } else if (id.includes('@s.whatsapp.net')) {
    pn = id;
  }
  
  const contactWithLid = contact as Contact & { lid?: string };
  if (contactWithLid.lid && !lid) {
    lid = contactWithLid.lid;
  }
  
  return {
    id,
    lid,
    pn,
    contactName: contact.name || null,
    notifyName: contact.notify || null,
    verifiedName: contact.verifiedName || null,
    imgUrl: contact.imgUrl || null,
    status: contact.status || null,
  };
}

export function getBestContactName(normalizedContact: NormalizedContactData): string {
  return normalizedContact.verifiedName 
    || normalizedContact.contactName 
    || normalizedContact.notifyName 
    || normalizedContact.pn 
    || normalizedContact.lid 
    || normalizedContact.id 
    || 'Unknown';
}

export function extractLidAndPn(remoteJid?: string, remoteJidAlt?: string): { lid: string; pn: string } {
  const jid1 = remoteJid || '';
  const jid2 = remoteJidAlt || '';

  if (jid1.includes('@lid')) {
    return {
      lid: jid1,
      pn: jid2 || jid1.split('@')[0] || 'unknown'
    };
  } else if (jid2.includes('@lid')) {
    return {
      lid: jid2,
      pn: jid1 || jid2.split('@')[0] || 'unknown'
    };
  }

  return {
    lid: jid1, // Fallback, might not be a real LID if it doesn't have @lid
    pn: jid1.split('@')[0] || 'unknown'
  };
}

export function isGroup(jid: string): boolean {
  return jid.includes('@g.us');
}

export function isOwnChat(chatId: string | null | undefined, phoneNumber: string | null): boolean {
  if (!chatId || !phoneNumber) return false;
  return chatId.includes(phoneNumber);
}

export function isOwnContact(lid: string | null, pn: string | null, phoneNumber: string | null): boolean {
  if (!phoneNumber) return false;
  // Check if lid or pn includes the phone number
  // Note: phoneNumber usually comes without @s.whatsapp.net, but lid/pn might have it.
  // We should be careful about matching.
  // If phoneNumber is just digits, and lid/pn contains it, it's likely a match.
  return (!!lid && lid.includes(phoneNumber)) || (!!pn && pn.includes(phoneNumber));
}
