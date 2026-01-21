import type { Contact, proto } from "baileys";
import {
  ContactoMeEscribe,
  GrupoMeEscribe,
  YoEscriboAContacto,
  YoEscriboAGrupo,
} from "./whatsapp-types";
import {
  contactoMeEscribeSchema,
  grupoMeEscribeSchema,
  yoEscriboAContactoSchema,
  yoEscriboAGrupoSchema,
} from "./whatsapp-types/schema";

export function extractMessageText(
  message: proto.IMessage | null | undefined,
): string {
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

export function normalizeContactData(
  contact: Contact | Partial<Contact>,
): NormalizedContactData {
  const id = contact.id || "";

  let lid: string | null = null;
  let pn: string | null = null;

  if (id.includes("@lid")) {
    lid = id;
  } else if (id.includes("@s.whatsapp.net")) {
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

export function getBestContactName(
  normalizedContact: NormalizedContactData,
): string {
  return (
    normalizedContact.verifiedName ||
    normalizedContact.contactName ||
    normalizedContact.notifyName ||
    normalizedContact.pn ||
    normalizedContact.lid ||
    normalizedContact.id ||
    "Unknown"
  );
}

type TPersonId = (
  | {
      lid: null;
      pn: string;
    }
  | {
      lid: string;
      pn: null;
    }
  | {
      lid: string;
      pn: string;
    }
) & {
  pushName: string;
};

export const get_Receiver_and_Sender_and_Context_FromMessage = (param: {
  key:
    | YoEscriboAContacto
    | ContactoMeEscribe
    | YoEscriboAGrupo
    | GrupoMeEscribe;
  pushName: string;
  broadcast: boolean;
  messageTimestamp: number;
}): {
  messageId: string;
  messageTimestamp: number;
  context:
    | {
        type: "personal";
      }
    | {
        type: "group";
        gid: `${string}@g.us`;
      };
  sender: (TPersonId | "me");
  receiver: (TPersonId | "me" | "group");
} | null => {
  const { key, pushName, broadcast, messageTimestamp } = param;

  if (broadcast) return null;

  const yoEscriboAContacto = yoEscriboAContactoSchema.safeParse(key);
  const yoEscriboAGrupo = yoEscriboAGrupoSchema.safeParse(key);
  const contactoMeEscribe = contactoMeEscribeSchema.safeParse(key);
  const alguienDelGrupoMeEscribe = grupoMeEscribeSchema.safeParse(key);

  let sender: (TPersonId | "me") | null = null;
  let receiver: (TPersonId | "me" | "group") | null = null;
  let context:
    | {
        type: "personal";
      }
    | {
        type: "group";
        gid: `${string}@g.us`;
      }
    | null = null;

  if (yoEscriboAContacto.success) {
    context = { type: "personal" };
    sender = "me";
    if (yoEscriboAContacto.data.addressingMode === "lid") {
      receiver = {
        lid: yoEscriboAContacto.data.remoteJid,
        pn: yoEscriboAContacto.data.remoteJidAlt || null,
        pushName,
      };
    } else {
      receiver = {
        pn: yoEscriboAContacto.data.remoteJid,
        lid: yoEscriboAContacto.data.remoteJidAlt || null,
        pushName,
      };
    }
  }

  if (yoEscriboAGrupo.success) {
    context = {
      type: "group",
      gid: yoEscriboAGrupo.data.remoteJid as `${string}@g.us`,
    };
    sender = "me";
    receiver = "group";
  }

  if (contactoMeEscribe.success) {
    context = { type: "personal" };
    receiver = "me";
    if (contactoMeEscribe.data.addressingMode === "lid") {
      sender = {
        lid: contactoMeEscribe.data.remoteJid,
        pn: contactoMeEscribe.data.remoteJidAlt || null,
        pushName,
      };
    } else {
      sender = {
        pn: contactoMeEscribe.data.remoteJid,
        lid: contactoMeEscribe.data.remoteJidAlt || null,
        pushName,
      };
    }
  }

  if (alguienDelGrupoMeEscribe.success) {
    context = {
      type: "group",
      gid: alguienDelGrupoMeEscribe.data.remoteJid as `${string}@g.us`,
    };
    receiver = "me";
    if (alguienDelGrupoMeEscribe.data.addressingMode === "lid") {
      sender = {
        lid: alguienDelGrupoMeEscribe.data.participant,
        pn: alguienDelGrupoMeEscribe.data.participantAlt || null,
        pushName,
      };
    } else {
      sender = {
        pn: alguienDelGrupoMeEscribe.data.participant,
        lid: alguienDelGrupoMeEscribe.data.participantAlt || null,
        pushName,
      };
    }
  }

  if (!context || !sender || !receiver) return null;

  return {
    messageId: key.id,
    messageTimestamp,
    context,
    sender,
    receiver,
  }
};

export function extractLidAndPn(
  remoteJid?: string,
  remoteJidAlt?: string,
): { lid: string | null; pn: string | null } {
  const jid1 = remoteJid || "";
  const jid2 = remoteJidAlt || "";

  // Check if jid1 is a LID
  if (jid1.includes("@lid")) {
    return {
      lid: jid1,
      pn: jid2.includes("@s.whatsapp.net") ? jid2 : null,
    };
  }

  // Check if jid2 is a LID
  if (jid2.includes("@lid")) {
    return {
      lid: jid2,
      pn: jid1.includes("@s.whatsapp.net") ? jid1 : null,
    };
  }

  // Check if jid1 is a PN (no LID available)
  if (jid1.includes("@s.whatsapp.net")) {
    return {
      lid: jid2.includes("@lid") ? jid2 : null,
      pn: jid1,
    };
  }

  // Check if jid2 is a PN
  if (jid2.includes("@s.whatsapp.net")) {
    return {
      lid: jid1.includes("@lid") ? jid1 : null,
      pn: jid2,
    };
  }

  // No valid identifiers found
  return {
    lid: null,
    pn: null,
  };
}

export function isGroup(jid: string): boolean {
  return jid.includes("@g.us");
}

export function isOwnChat(
  chatId: string | null | undefined,
  phoneNumber: string | null,
): boolean {
  if (!chatId || !phoneNumber) return false;
  return chatId.includes(phoneNumber);
}

export function isOwnContact(
  lid: string | null,
  pn: string | null,
  phoneNumber: string | null,
): boolean {
  if (!phoneNumber) return false;
  // Check if lid or pn includes the phone number
  // Note: phoneNumber usually comes without @s.whatsapp.net, but lid/pn might have it.
  // We should be careful about matching.
  // If phoneNumber is just digits, and lid/pn contains it, it's likely a match.
  return (
    (!!lid && lid.includes(phoneNumber)) || (!!pn && pn.includes(phoneNumber))
  );
}
