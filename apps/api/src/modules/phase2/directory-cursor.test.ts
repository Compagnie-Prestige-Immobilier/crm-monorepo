import { BadRequestException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';

import {
  decodeDirectoryCursor,
  encodeDirectoryCursor,
  fromMicros,
  toMicros,
} from './directory-cursor.js';

describe('curseur d’annuaire', () => {
  it('fait l’aller-retour sans perte', () => {
    const cursor = { v: 1 as const, t: 1_775_000_123_456_000, id: '01931f3c-1a2b-7c4d-8e5f-aaaa' };
    expect(decodeDirectoryCursor(encodeDirectoryCursor(cursor))).toEqual(cursor);
  });

  it('rend undefined pour un premier appel', () => {
    expect(decodeDirectoryCursor(undefined)).toBeUndefined();
    expect(decodeDirectoryCursor('')).toBeUndefined();
  });

  it('est opaque : le client ne doit pas être tenté de le fabriquer', () => {
    const encoded = encodeDirectoryCursor({ v: 1, t: 1_000, id: 'x' });
    expect(encoded).not.toContain('{');
    expect(encoded).not.toContain('=');
  });

  it('refuse un curseur illisible plutôt que de repartir de zéro en silence', () => {
    expect(() => decodeDirectoryCursor('pas-du-base64url-json')).toThrow(BadRequestException);
  });

  it('refuse une version inconnue', () => {
    const forged = Buffer.from(JSON.stringify({ v: 2, t: 1, id: 'a' })).toString('base64url');
    expect(() => decodeDirectoryCursor(forged)).toThrow(BadRequestException);
  });

  it('refuse une position incomplète', () => {
    const noId = Buffer.from(JSON.stringify({ v: 1, t: 1 })).toString('base64url');
    const noTime = Buffer.from(JSON.stringify({ v: 1, id: 'a' })).toString('base64url');
    expect(() => decodeDirectoryCursor(noId)).toThrow(BadRequestException);
    expect(() => decodeDirectoryCursor(noTime)).toThrow(BadRequestException);
  });

  it.each([
    ['hors du domaine des dates', 1e300],
    ['négatif', -1],
    ['fractionnaire', 1_775_000_123_456_000.5],
  ])('refuse un horodatage %s au lieu de le passer à Prisma', (_label, t) => {
    const poisoned = Buffer.from(JSON.stringify({ v: 1, t, id: 'a' })).toString('base64url');
    expect(() => decodeDirectoryCursor(poisoned)).toThrow(BadRequestException);
  });

  it('accepte un horodatage réaliste et rend une Date valide', () => {
    const t = toMicros(new Date('2026-04-08T14:30:00.123Z'));
    const encoded = encodeDirectoryCursor({ v: 1, t, id: 'a' });
    expect(decodeDirectoryCursor(encoded)).toEqual({ v: 1, t, id: 'a' });
    expect(Number.isNaN(fromMicros(t).getTime())).toBe(false);
  });

  it('porte un code métier exploitable par le mobile', () => {
    let leve: unknown;
    try {
      decodeDirectoryCursor('!!!');
    } catch (error) {
      leve = error;
    }

    expect(leve).toBeInstanceOf(BadRequestException);
    expect((leve as BadRequestException).getResponse()).toMatchObject({
      code: 'PHASE2_DIRECTORY_CURSOR_INVALID',
    });
  });

  it('convertit les microsecondes sans dériver', () => {
    const date = new Date('2026-04-08T14:30:00.123Z');
    expect(fromMicros(toMicros(date)).getTime()).toBe(date.getTime());
  });
});
