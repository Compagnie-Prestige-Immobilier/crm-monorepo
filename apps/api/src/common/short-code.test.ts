import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import {
  CROCKFORD_ALPHABET,
  SHORT_CODE_LENGTH,
  hasShortCodeCollision,
  shortCode,
} from './short-code.js';

function fixtureUuids(count: number): string[] {
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) {
    const hex = createHash('sha256')
      .update(`prospect-${String(index)}`)
      .digest('hex');
    ids.push(
      [
        hex.slice(0, 8),
        hex.slice(8, 12),
        `7${hex.slice(13, 16)}`,
        `8${hex.slice(17, 20)}`,
        hex.slice(20, 32),
      ].join('-'),
    );
  }
  return ids;
}

describe('shortCode', () => {
  it('produit six caractères de l’alphabet Crockford', () => {
    for (const id of fixtureUuids(200)) {
      const code = shortCode(id);
      expect(code).toHaveLength(SHORT_CODE_LENGTH);
      for (const char of code) expect(CROCKFORD_ALPHABET).toContain(char);
    }
  });

  it('n’émet jamais I, L, O ni U, les caractères qui se confondent à la lecture', () => {
    const codes = fixtureUuids(2_000).map(shortCode).join('');
    expect(codes).not.toMatch(/[ILOU]/);
  });

  it('est déterministe : le même identifiant donne toujours le même code', () => {
    const id = '01931f3c-1a2b-7c4d-8e5f-0a1b2c3d4e5f';
    const first = shortCode(id);
    expect(shortCode(id)).toBe(first);
    expect(shortCode(id)).toBe(first);
    expect(first).toBe(shortCode('01931f3c-1a2b-7c4d-8e5f-0a1b2c3d4e5f'));
  });

  it('normalise la casse et les espaces de l’identifiant', () => {
    const id = '01931f3c-1a2b-7c4d-8e5f-0a1b2c3d4e5f';
    expect(shortCode(id.toUpperCase())).toBe(shortCode(id));
    expect(shortCode(`  ${id}  `)).toBe(shortCode(id));
  });

  it('ne tronque pas l’UUID : deux UUID v7 de la même milliseconde ont des codes distincts', () => {
    const prefix = '01931f3c-1a2b-7c4d-8e5f-';
    const codes = new Set(
      Array.from({ length: 500 }, (_, index) =>
        shortCode(`${prefix}${String(index).padStart(12, '0')}`),
      ),
    );
    expect(codes.size).toBe(500);
  });

  it('ne produit aucune collision sur une campagne de 5 000 lignes', () => {
    const ids = fixtureUuids(5_000);
    expect(hasShortCodeCollision(ids)).toBe(false);
    expect(new Set(ids.map(shortCode)).size).toBe(ids.length);
  });

  it('hasShortCodeCollision détecte un doublon', () => {
    const [first, second] = fixtureUuids(2) as [string, string];
    expect(hasShortCodeCollision([first, second, first])).toBe(true);
  });
});
