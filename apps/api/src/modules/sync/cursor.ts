import { BadRequestException } from '@nestjs/common';

import { isValidCursorMicros } from '../../common/cursor-micros.js';

/**
 * Curseur de pagination du pull delta.
 *
 * IL NE PEUT PAS ÊTRE UN SIMPLE HORODATAGE. Deux lignes écrites dans la même
 * milliseconde et séparées par une frontière de page se perdent silencieusement :
 * la page 1 se termine sur la première, la page 2 demande « strictement après
 * cette milliseconde » et saute la seconde. Le client ne voit jamais l'erreur,
 * il lui manque simplement un prospect, pour toujours.
 *
 * On pagine donc en keyset sur le COUPLE `(updatedAt, id)`, exactement l'index
 * composite posé dans le schéma. Le curseur transporte les deux moitiés.
 *
 * `t` est exprimé en MICROsecondes. Les colonnes sont en `TIMESTAMP(3)`, donc
 * à la milliseconde, mais l'unité microseconde est celle de PostgreSQL, et
 * l'adopter dès maintenant évite d'avoir à faire migrer des curseurs déjà
 * distribués sur des téléphones le jour où la précision de la colonne change.
 *
 * L'encodage est opaque (base64url d'un JSON) pour que le client ne soit pas
 * tenté de le fabriquer ou de l'interpréter : sa structure doit rester libre
 * d'évoluer côté serveur.
 */

export interface StreamPosition {
  /** updatedAt en microsecondes depuis l'epoch. */
  t: number;
  /** Identifiant de la dernière ligne servie, départageant les ex æquo. */
  id: string;
}

/** Les six flux servis par le pull. Les référentiels ont leur propre position. */
export const SYNC_STREAMS = [
  'departements',
  'iefs',
  'banques',
  'syndicats',
  'representants',
  'prospects',
] as const;

export type SyncStream = (typeof SYNC_STREAMS)[number];

export interface SyncCursor {
  /** Version du format, pour pouvoir invalider proprement un curseur ancien. */
  v: 1;
  streams: Partial<Record<SyncStream, StreamPosition>>;
}

export const EMPTY_CURSOR: SyncCursor = { v: 1, streams: {} };

export const toMicros = (date: Date): number => date.getTime() * 1000;
export const fromMicros = (micros: number): Date => new Date(Math.floor(micros / 1000));

export function encodeCursor(cursor: SyncCursor): string {
  return Buffer.from(JSON.stringify(cursor), 'utf8').toString('base64url');
}

export function decodeCursor(raw: string | undefined): SyncCursor {
  if (!raw) return EMPTY_CURSOR;

  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
  } catch {
    throw new BadRequestException({
      code: 'SYNC_CURSOR_INVALID',
      message: 'Curseur de synchronisation illisible. Relancez une synchronisation complète.',
    });
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new BadRequestException({
      code: 'SYNC_CURSOR_INVALID',
      message: 'Curseur de synchronisation illisible.',
    });
  }

  const candidate = parsed as { v?: unknown; streams?: unknown };
  if (candidate.v !== 1) {
    throw new BadRequestException({
      code: 'SYNC_CURSOR_VERSION_UNSUPPORTED',
      message: 'Curseur d’une version non prise en charge. Relancez une synchronisation complète.',
    });
  }

  const streams: Partial<Record<SyncStream, StreamPosition>> = {};
  const rawStreams = (candidate.streams ?? {}) as Record<string, unknown>;
  for (const stream of SYNC_STREAMS) {
    const position = rawStreams[stream];
    if (typeof position !== 'object' || position === null) continue;
    const { t, id } = position as { t?: unknown; id?: unknown };
    // Un curseur partiellement corrompu est refusé plutôt que réparé : le
    // « réparer » en repartant de zéro sur un flux ferait retélécharger toute
    // la base sans que personne ne comprenne pourquoi.
    if (!isValidCursorMicros(t) || typeof id !== 'string' || !id) {
      throw new BadRequestException({
        code: 'SYNC_CURSOR_INVALID',
        message: `Position de curseur illisible pour le flux ${stream}.`,
      });
    }
    streams[stream] = { t, id };
  }

  return { v: 1, streams };
}

/** Position à partir d'une ligne servie. */
export const positionOf = (row: { updatedAt: Date; id: string }): StreamPosition => ({
  t: toMicros(row.updatedAt),
  id: row.id,
});

/** Remplace la position d'un flux sans toucher aux autres. */
export function advance(
  cursor: SyncCursor,
  stream: SyncStream,
  position: StreamPosition | undefined,
): SyncCursor {
  if (!position) return cursor;
  return { v: 1, streams: { ...cursor.streams, [stream]: position } };
}
