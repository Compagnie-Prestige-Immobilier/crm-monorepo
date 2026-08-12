import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import {
  EMPTY_CURSOR,
  advance,
  decodeCursor,
  encodeCursor,
  fromMicros,
  positionOf,
  toMicros,
} from './cursor.js';

describe('curseur de pull', () => {
  it('fait l’aller-retour sans perte', () => {
    const cursor = {
      v: 1 as const,
      streams: {
        prospects: { t: 1_760_000_000_123_000, id: 'p-1' },
        banques: { t: 1_759_000_000_000_000, id: 'b-9' },
      },
    };
    expect(decodeCursor(encodeCursor(cursor))).toEqual(cursor);
  });

  it('est opaque : base64url, sans caractère à échapper dans une URL', () => {
    const encoded = encodeCursor({ v: 1, streams: { prospects: { t: 1, id: 'a/b+c' } } });
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(encodeURIComponent(encoded)).toBe(encoded);
  });

  it('un curseur absent vaut « depuis le début »', () => {
    expect(decodeCursor(undefined)).toEqual(EMPTY_CURSOR);
    expect(decodeCursor('')).toEqual(EMPTY_CURSOR);
  });

  it('refuse un curseur illisible plutôt que de repartir de zéro', () => {
    expect(() => decodeCursor('pas-du-base64-json')).toThrow(BadRequestException);
    expect(() => decodeCursor(Buffer.from('{"v":1', 'utf8').toString('base64url'))).toThrow(
      BadRequestException,
    );
  });

  it('refuse une version de format inconnue', () => {
    const future = Buffer.from(JSON.stringify({ v: 2, streams: {} }), 'utf8').toString('base64url');
    expect(() => decodeCursor(future)).toThrow(BadRequestException);
  });

  it('refuse une position tronquée au lieu de la réparer', () => {
    const broken = Buffer.from(
      JSON.stringify({ v: 1, streams: { prospects: { t: 12 } } }),
      'utf8',
    ).toString('base64url');
    expect(() => decodeCursor(broken)).toThrow(BadRequestException);
  });

  it('conserve chaque flux indépendamment : avancer les prospects ne rejoue pas les banques', () => {
    const start = advance(EMPTY_CURSOR, 'banques', { t: 5_000, id: 'b-1' });
    const next = advance(start, 'prospects', { t: 9_000, id: 'p-1' });
    expect(next.streams.banques).toEqual({ t: 5_000, id: 'b-1' });
    expect(next.streams.prospects).toEqual({ t: 9_000, id: 'p-1' });
  });

  it('convertit millisecondes et microsecondes sans dérive', () => {
    const date = new Date('2026-08-12T10:00:00.123Z');
    expect(toMicros(date)).toBe(date.getTime() * 1000);
    expect(fromMicros(toMicros(date)).getTime()).toBe(date.getTime());
  });

  it('positionOf capture les deux moitiés de la clé de tri', () => {
    const date = new Date('2026-08-12T10:00:00.456Z');
    expect(positionOf({ updatedAt: date, id: 'x' })).toEqual({ t: toMicros(date), id: 'x' });
  });
});
