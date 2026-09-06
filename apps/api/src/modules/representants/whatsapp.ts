import { BadRequestException } from '@nestjs/common';
import { WhatsappStatus } from '@crm/database';

import { normalizePhone } from '../../common/phone.js';

const WhatsappError = {
  NUMBER_NOT_ALLOWED: 'WHATSAPP_NUMBER_NOT_ALLOWED',
  NUMBER_REQUIRED: 'WHATSAPP_NUMBER_REQUIRED',
} as const;

const whatsappNumberNotAllowed = (): BadRequestException =>
  new BadRequestException({
    code: WhatsappError.NUMBER_NOT_ALLOWED,
    message: 'Un numéro WhatsApp distinct n’a de sens qu’avec le statut AUTRE_NUMERO.',
  });

const whatsappNumberRequired = (): BadRequestException =>
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

function professionPatch(input: WhatsappInput): Partial<WhatsappPatch> {
  return input.profession === undefined ? {} : { profession: input.profession.trim() || null };
}

function normalizedWhatsappNumber(input: WhatsappInput): string | null {
  return input.whatsappE164 === undefined ? null : normalizePhone(input.whatsappE164);
}

function assertWhatsappNumberConsistency(
  status: WhatsappStatus,
  number: string | null,
  current: WhatsappState,
): void {
  if (number !== null && status !== WhatsappStatus.AUTRE_NUMERO) throw whatsappNumberNotAllowed();
  if (status !== WhatsappStatus.AUTRE_NUMERO) return;
  if (number === null && current.whatsappE164 === null) throw whatsappNumberRequired();
}

function whatsappE164Patch(
  status: WhatsappStatus,
  number: string | null,
  current: WhatsappState,
): Partial<WhatsappPatch> {
  if (status === WhatsappStatus.AUTRE_NUMERO) return number === null ? {} : { whatsappE164: number };
  return current.whatsappE164 === null ? {} : { whatsappE164: null };
}

/**
 * CHAQUE CHAMP EST INDÉPENDAMMENT FACULTATIF : un appel interrompu ne doit rien
 * perdre de ce qui a été dit avant. Seule une incohérence que le CHECK refuse
 * aussi fait échouer le recueil ; un patch vide dit que rien n'a été appris.
 */
export function resolveWhatsappPatch(input: WhatsappInput, current: WhatsappState): WhatsappPatch {
  if (input.whatsappStatus === undefined && input.whatsappE164 === undefined) {
    return professionPatch(input);
  }

  const number = normalizedWhatsappNumber(input);
  const status = input.whatsappStatus ?? current.whatsappStatus;
  assertWhatsappNumberConsistency(status, number, current);

  return {
    ...professionPatch(input),
    ...(input.whatsappStatus !== undefined ? { whatsappStatus: input.whatsappStatus } : {}),
    ...whatsappE164Patch(status, number, current),
  };
}
