import { BadRequestException } from '@nestjs/common';

import { isValidCursorMicros } from '../../common/cursor-micros.js';

export interface StreamPosition {
  t: number;
  id: string;
}

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

export const positionOf = (row: { updatedAt: Date; id: string }): StreamPosition => ({
  t: toMicros(row.updatedAt),
  id: row.id,
});

export function advance(
  cursor: SyncCursor,
  stream: SyncStream,
  position: StreamPosition | undefined,
): SyncCursor {
  if (!position) return cursor;
  return { v: 1, streams: { ...cursor.streams, [stream]: position } };
}
