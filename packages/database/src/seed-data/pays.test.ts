import { describe, expect, it } from 'vitest';

import { PAYS } from './pays.js';
import { EMPLOYEURS_SENEGAL } from './employeurs.js';

describe('référentiel des pays', () => {
  it('couvre la liste ISO sans code ni libellé dupliqué', () => {
    expect(PAYS.length).toBeGreaterThanOrEqual(240);
    expect(new Set(PAYS.map((row) => row.code)).size).toBe(PAYS.length);
    expect(new Set(PAYS.map((row) => row.label)).size).toBe(PAYS.length);
  });

  it('porte un code alpha-2 et un indicatif purement numérique', () => {
    for (const pays of PAYS) {
      expect(pays.code).toMatch(/^[A-Z]{2}$/);
      expect(pays.indicatif).toMatch(/^\d{1,4}$/);
    }
  });

  it('met la diaspora en tête', () => {
    expect(PAYS.slice(0, 15).map((row) => row.code)).toEqual([
      'FR',
      'IT',
      'ES',
      'US',
      'GM',
      'MR',
      'ML',
      'CI',
      'MA',
      'GA',
      'DE',
      'BE',
      'CA',
      'PT',
      'SA',
    ]);
    expect(PAYS.find((row) => row.code === 'SN')?.indicatif).toBe('221');
  });
});

describe('référentiel des employeurs', () => {
  it('n’a ni code ni libellé dupliqué, et range ministères puis entreprises', () => {
    expect(new Set(EMPLOYEURS_SENEGAL.map((row) => row.code)).size).toBe(EMPLOYEURS_SENEGAL.length);
    expect(new Set(EMPLOYEURS_SENEGAL.map((row) => row.label)).size).toBe(
      EMPLOYEURS_SENEGAL.length,
    );
    expect(EMPLOYEURS_SENEGAL.map((row) => row.position)).toEqual(
      EMPLOYEURS_SENEGAL.map((_row, index) => index + 1),
    );
    const ministeres = EMPLOYEURS_SENEGAL.filter((row) => row.type === 'MINISTERE');
    expect(ministeres.length).toBeGreaterThanOrEqual(20);
    expect(
      EMPLOYEURS_SENEGAL.filter((row) => row.type === 'ENTREPRISE').length,
    ).toBeGreaterThanOrEqual(10);
  });
});
