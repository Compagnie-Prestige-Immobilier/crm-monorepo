import { BadRequestException } from '@nestjs/common';

import { isValidCursorMicros } from '../../common/cursor-micros.js';

export interface DirectoryCursor {
  v: 1;
  t: number;
  id: string;
}

const invalid = (message: string): never => {
  throw new BadRequestException({ code: 'PHASE2_DIRECTORY_CURSOR_INVALID', message });
};

export const toMicros = (date: Date): number => date.getTime() * 1000;
export const fromMicros = (micros: number): Date => new Date(Math.floor(micros / 1000));

export function encodeDirectoryCursor(cursor: DirectoryCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeDirectoryCursor(raw: string | undefined): DirectoryCursor | undefined {
  if (!raw) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    return invalid('Curseur d’annuaire illisible. Relancez un téléchargement complet.');
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return invalid('Curseur d’annuaire illisible.');
  }

  const candidate = parsed as { v?: unknown; t?: unknown; id?: unknown };
  if (candidate.v !== 1) {
    return invalid('Curseur d’annuaire d’une version non prise en charge.');
  }
  if (!isValidCursorMicros(candidate.t)) {
    return invalid('Position de curseur illisible.');
  }
  if (typeof candidate.id !== 'string' || candidate.id === '') {
    return invalid('Position de curseur illisible.');
  }

  return { v: 1, t: candidate.t, id: candidate.id };
}
