import { describe, expect, it } from 'vitest';

import {
  dayHistogram,
  dayIndexFor,
  distributeRoundRobin,
  newCampaignSeed,
  toPostgresSeed,
} from './distribution.js';

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

describe('dayIndexFor', () => {
  it('range tout au jour 0 quand la campagne n’est pas étalée', () => {
    for (const position of [1, 2, 50, 1_000]) {
      expect(dayIndexFor(position, 1_000, 1)).toBe(0);
    }
  });

  it('découpe en tranches CONTIGUËS : le jour 2 suit le jour 1', () => {
    const days = Array.from({ length: 9 }, (_, index) => dayIndexFor(index + 1, 9, 3));
    expect(days).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2]);
  });

  it('RÉPARTIT le reste au lieu de l’empiler sur la dernière journée', () => {
    expect(dayHistogram(10, 3)).toEqual([4, 3, 3]);
    expect(dayHistogram(100, 7)).toEqual([15, 14, 14, 15, 14, 14, 14]);
  });

  it('rend toujours autant de cases que de journées demandées', () => {
    expect(dayHistogram(3, 7)).toEqual([1, 1, 1, 0, 0, 0, 0]);
    expect(dayHistogram(0, 4)).toEqual([0, 0, 0, 0]);
    expect(dayHistogram(3, 7)).toHaveLength(7);
  });

  it('ne dilue pas les lignes dans les journées ajoutées', () => {
    const buckets = dayHistogram(3, 7);
    expect(buckets.filter((size) => size > 0)).toEqual([1, 1, 1]);
  });

  it('conserve toutes les lignes et reste dans les bornes', () => {
    for (const count of [0, 1, 7, 120, 5_003]) {
      for (const days of [1, 2, 7, 31]) {
        const buckets = dayHistogram(count, days);
        expect(buckets.reduce((sum, size) => sum + size, 0)).toBe(count);
        expect(Math.max(...buckets) - Math.min(...buckets)).toBeLessThanOrEqual(1);
        for (let position = 1; position <= count; position += 1) {
          const index = dayIndexFor(position, count, days);
          expect(index).toBeGreaterThanOrEqual(0);
          expect(index).toBeLessThan(buckets.length);
        }
      }
    }
  });
});
