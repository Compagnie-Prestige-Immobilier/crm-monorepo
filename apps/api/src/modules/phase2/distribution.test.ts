import { describe, expect, it } from 'vitest';

import { distributeRoundRobin, newCampaignSeed, toPostgresSeed } from './distribution.js';

describe('newCampaignSeed', () => {
  it('produit 32 caractères hexadécimaux', () => {
    expect(newCampaignSeed()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('ne se répète pas', () => {
    const seeds = new Set(Array.from({ length: 200 }, newCampaignSeed));
    expect(seeds.size).toBe(200);
  });
});

describe('toPostgresSeed', () => {
  it('reste dans l’intervalle admis par setseed', () => {
    for (let index = 0; index < 500; index += 1) {
      const value = toPostgresSeed(newCampaignSeed());
      expect(value).toBeGreaterThanOrEqual(-1);
      expect(value).toBeLessThan(1);
    }
  });

  it('est déterministe : c’est toute la valeur d’auditer une graine', () => {
    const seed = '0f1e2d3c4b5a69788796a5b4c3d2e1f0';
    expect(toPostgresSeed(seed)).toBe(toPostgresSeed(seed));
  });

  it('sépare deux graines voisines', () => {
    expect(toPostgresSeed('a'.repeat(32))).not.toBe(toPostgresSeed(`${'a'.repeat(31)}b`));
  });
});

describe('distributeRoundRobin', () => {
  const idsOf = (count: number): string[] =>
    Array.from({ length: count }, (_, index) => `p${String(index)}`);

  it('affecte chaque élément une fois et une seule', () => {
    const items = idsOf(97);
    const assignments = distributeRoundRobin(items, 4);
    expect(assignments).toHaveLength(items.length);
    expect(new Set(assignments.map((a) => a.item)).size).toBe(items.length);
  });

  it('numérote les positions de 1 à N par commercial, sans trou', () => {
    const assignments = distributeRoundRobin(idsOf(97), 4);
    for (let bucket = 0; bucket < 4; bucket += 1) {
      const positions = assignments.filter((a) => a.bucket === bucket).map((a) => a.position);
      expect(positions).toEqual(Array.from({ length: positions.length }, (_, i) => i + 1));
    }
  });

  it('ne laisse jamais plus d’une ligne d’écart entre commerciaux', () => {
    for (const total of [0, 1, 3, 4, 5, 99, 100, 101, 1_000, 4_999]) {
      for (const buckets of [1, 2, 3, 4, 7]) {
        const assignments = distributeRoundRobin(idsOf(total), buckets);
        const sizes = Array.from(
          { length: buckets },
          (_, bucket) => assignments.filter((a) => a.bucket === bucket).length,
        );
        expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
        expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(total);
      }
    }
  });

  it('préserve l’ordre du tirage à l’intérieur du lot de chaque commercial', () => {
    const items = idsOf(10);
    const assignments = distributeRoundRobin(items, 3);
    const first = assignments.filter((a) => a.bucket === 0).map((a) => a.item);
    expect(first).toEqual(['p0', 'p3', 'p6', 'p9']);
  });

  it('refuse un nombre de commerciaux nul', () => {
    expect(() => distributeRoundRobin(idsOf(3), 0)).toThrow();
  });
});
