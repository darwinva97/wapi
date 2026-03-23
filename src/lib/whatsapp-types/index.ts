export type IdsAddressingModeContact = {
  remoteJid: `${string}@lid` ;
  remoteJidAlt: `${string}@s.whatsapp.net`;
  addressingMode: "lid";
} | {
  remoteJid: `${string}@s.whatsapp.net`;
  remoteJidAlt: `${string}@lid` ;
  addressingMode: "pn";
}
export type IdsAddressingModeGroup = {
  remoteJid: `${string}@g.us` ;
  remoteJidAlt: undefined;
  id: string;
}

export type YoEscriboAContacto = IdsAddressingModeContact & {
  fromMe: true;
  id: string;
  participant: "";
  participantAlt: undefined;
};
export type ContactoMeEscribe = IdsAddressingModeContact & {
  fromMe: false;
  id: string;
  participant: "";
  participantAlt: undefined;
};
export type YoEscriboAGrupo = IdsAddressingModeGroup & {
  participant: `${string}@lid` ;
  participantAlt: `${string}@s.whatsapp.net` | undefined;
  addressingMode: "lid";
  fromMe: true;
};
export type GrupoMeEscribe = IdsAddressingModeGroup & {
  fromMe: false;
} & ({
  participant: `${string}@s.whatsapp.net`;
  participantAlt: `${string}@lid` | undefined;
  addressingMode: "pn";
} | {
  participant: `${string}@lid`;
  participantAlt: `${string}@s.whatsapp.net` | undefined;
  addressingMode: "lid";
});
