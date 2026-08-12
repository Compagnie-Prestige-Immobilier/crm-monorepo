import { describe, expect, it } from 'vitest';

import { canonicalize, requestHash } from './request-hash.js';

describe('empreinte canonique du lot', () => {
  it('ignore l’ordre des clés : un rejeu légitime ne doit pas passer pour un autre contenu', () => {
    const left = { clientBatchId: 'b1', payloadVersion: 1, operations: [{ opId: 'o1', seq: 0 }] };
    const right = { operations: [{ seq: 0, opId: 'o1' }], payloadVersion: 1, clientBatchId: 'b1' };
    expect(requestHash(left)).toBe(requestHash(right));
  });

  it('respecte l’ordre des tableaux : dans `operations`, il porte du sens', () => {
    const left = { operations: [{ opId: 'a' }, { opId: 'b' }] };
    const right = { operations: [{ opId: 'b' }, { opId: 'a' }] };
    expect(requestHash(left)).not.toBe(requestHash(right));
  });

  it('distingue deux contenus différents', () => {
    expect(requestHash({ a: 1 })).not.toBe(requestHash({ a: 2 }));
  });

  it('traite un champ absent et un champ à undefined comme identiques', () => {
    expect(requestHash({ a: 1, b: undefined })).toBe(requestHash({ a: 1 }));
  });

  it('normalise les dates en ISO', () => {
    const date = new Date('2026-08-12T10:00:00.000Z');
    expect(canonicalize({ at: date })).toEqual({ at: '2026-08-12T10:00:00.000Z' });
  });

  it('est stable d’un appel à l’autre', () => {
    const body = { clientBatchId: 'b1', operations: [{ opId: 'o1', data: { phone: '77' } }] };
    expect(requestHash(body)).toBe(requestHash(body));
  });

  it('trie récursivement, jusque dans les objets imbriqués', () => {
    expect(canonicalize({ b: { d: 1, c: 2 }, a: 3 })).toEqual({ a: 3, b: { c: 2, d: 1 } });
    expect(Object.keys(canonicalize({ b: 1, a: 2 }) as object)).toEqual(['a', 'b']);
  });
});
