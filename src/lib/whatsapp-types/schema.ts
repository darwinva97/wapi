import { z } from "zod";

// Base schemas para los diferentes tipos de JID
const lidJidSchema = z.string().regex(/^.+@lid$/, "Must be a LID JID (@lid)");
const pnJidSchema = z.string().regex(/^.+@s\.whatsapp\.net$/, "Must be a PN JID (@s.whatsapp.net)");
const groupJidSchema = z.string().regex(/^.+@g\.us$/, "Must be a group JID (@g.us)");

// IdsAddressingModeContact - LID mode
const idsAddressingModeContactLidSchema = z.object({
  remoteJid: lidJidSchema,
  remoteJidAlt: pnJidSchema,
  addressingMode: z.literal("lid"),
});

// IdsAddressingModeContact - PN mode
const idsAddressingModeContactPnSchema = z.object({
  remoteJid: pnJidSchema,
  remoteJidAlt: lidJidSchema,
  addressingMode: z.literal("pn"),
});

// Union de ambos modos de contacto
export const idsAddressingModeContactSchema = z.union([
  idsAddressingModeContactLidSchema,
  idsAddressingModeContactPnSchema,
]);

// IdsAddressingModeGroup
export const idsAddressingModeGroupSchema = z.object({
  remoteJid: groupJidSchema,
  remoteJidAlt: z.undefined(),
  id: z.string(),
});

// YoEscriboAContacto
export const yoEscriboAContactoSchema = idsAddressingModeContactSchema.and(
  z.object({
    fromMe: z.literal(true),
    id: z.string(),
    participant: z.literal(""),
    participantAlt: z.undefined(),
  })
);

// ContactoMeEscribe
export const contactoMeEscribeSchema = idsAddressingModeContactSchema.and(
  z.object({
    fromMe: z.literal(false),
    id: z.string(),
    participant: z.literal(""),
    participantAlt: z.undefined(),
  })
);

// YoEscriboAGrupo
export const yoEscriboAGrupoSchema = idsAddressingModeGroupSchema.and(
  z.object({
    participant: lidJidSchema,
    participantAlt: pnJidSchema.optional(),
    addressingMode: z.literal("lid"),
    fromMe: z.literal(true),
  })
);

// GrupoMeEscribe - puede ser modo PN o LID
const grupoMeEscribePnSchema = z.object({
  participant: pnJidSchema,
  participantAlt: lidJidSchema.optional(),
  addressingMode: z.literal("pn"),
});

const grupoMeEscribeLidSchema = z.object({
  participant: lidJidSchema,
  participantAlt: pnJidSchema.optional(),
  addressingMode: z.literal("lid"),
});

export const grupoMeEscribeSchema = idsAddressingModeGroupSchema
  .and(z.object({ fromMe: z.literal(false) }))
  .and(z.union([grupoMeEscribePnSchema, grupoMeEscribeLidSchema]));

// Tipos inferidos desde los schemas
export type IdsAddressingModeContact = z.infer<typeof idsAddressingModeContactSchema>;
export type IdsAddressingModeGroup = z.infer<typeof idsAddressingModeGroupSchema>;
export type YoEscriboAContacto = z.infer<typeof yoEscriboAContactoSchema>;
export type ContactoMeEscribe = z.infer<typeof contactoMeEscribeSchema>;
export type YoEscriboAGrupo = z.infer<typeof yoEscriboAGrupoSchema>;
export type GrupoMeEscribe = z.infer<typeof grupoMeEscribeSchema>;
