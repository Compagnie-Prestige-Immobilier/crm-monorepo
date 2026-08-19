import { BadRequestException } from '@nestjs/common';
import { WhatsappStatus } from '@crm/database';

import { normalizePhone } from '../../common/phone.js';

export const WhatsappError = {
  NUMBER_NOT_ALLOWED: 'WHATSAPP_NUMBER_NOT_ALLOWED',
  NUMBER_REQUIRED: 'WHATSAPP_NUMBER_REQUIRED',
} as const;

export const whatsappNumberNotAllowed = (): BadRequestException =>
  new BadRequestException({
    code: WhatsappError.NUMBER_NOT_ALLOWED,
    message: 'Un numéro WhatsApp distinct n’a de sens qu’avec le statut AUTRE_NUMERO.',
  });

export const whatsappNumberRequired = (): BadRequestException =>
  new BadRequestException({
    code: WhatsappError.NUMBER_REQUIRED,
    message: 'Le statut AUTRE_NUMERO exige le numéro WhatsApp.',
  });

export interface WhatsappInput {
  readonly whatsappStatus?: WhatsappStatus;
  readonly whatsappE164?: string;
  readonly profession?: string;
}

export interface WhatsappState {
  readonly whatsappStatus: WhatsappStatus;
  readonly whatsappE164: string | null;
}

export interface WhatsappPatch {
  whatsappStatus?: WhatsappStatus;
  whatsappE164?: string | null;
  profession?: string | null;
}

const REACHABLE: readonly WhatsappStatus[] = [
  WhatsappStatus.MEME_NUMERO,
  WhatsappStatus.AUTRE_NUMERO,
];

export const hasReachableWhatsapp = (status: WhatsappStatus): boolean => REACHABLE.includes(status);

/**
 * Recomposé à la lecture : sur MEME_NUMERO la colonne dédiée reste nulle, car
 * une copie de `phoneE164` pointerait sur un autre abonné dès la première
 * correction du téléphone.
 */
export function whatsappNumberOf(row: WhatsappState & { phoneE164: string }): string | null {
  if (row.whatsappStatus === WhatsappStatus.MEME_NUMERO) return row.phoneE164;
  if (row.whatsappStatus === WhatsappStatus.AUTRE_NUMERO) return row.whatsappE164;
  return null;
}

/**
 * CHAQUE CHAMP EST INDÉPENDAMMENT FACULTATIF : un appel interrompu ne doit rien
 * perdre de ce qui a été dit avant. Seule une incohérence que le CHECK refuse
 * aussi fait échouer le recueil ; un patch vide dit que rien n'a été appris.
 */
export function resolveWhatsappPatch(input: WhatsappInput, current: WhatsappState): WhatsappPatch {
  const patch: WhatsappPatch = {};
  if (input.profession !== undefined) patch.profession = input.profession.trim() || null;
  if (input.whatsappStatus === undefined && input.whatsappE164 === undefined) return patch;

  const number = input.whatsappE164 === undefined ? null : normalizePhone(input.whatsappE164);
  const status = input.whatsappStatus ?? current.whatsappStatus;

  if (number !== null && status !== WhatsappStatus.AUTRE_NUMERO) throw whatsappNumberNotAllowed();
  if (status === WhatsappStatus.AUTRE_NUMERO && number === null && current.whatsappE164 === null) {
    throw whatsappNumberRequired();
  }

  if (input.whatsappStatus !== undefined) patch.whatsappStatus = input.whatsappStatus;

  if (status !== WhatsappStatus.AUTRE_NUMERO) {
    if (current.whatsappE164 !== null) patch.whatsappE164 = null;
  } else if (number !== null) {
    patch.whatsappE164 = number;
  }

  return patch;
}
