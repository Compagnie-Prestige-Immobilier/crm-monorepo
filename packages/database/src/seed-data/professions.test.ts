import { describe, expect, it } from 'vitest';

import { PROFESSIONS_SENEGAL } from './professions.js';

describe('référentiel des professions', () => {
  it('couvre au moins 200 métiers sans code ni libellé dupliqué', () => {
    expect(PROFESSIONS_SENEGAL.length).toBeGreaterThanOrEqual(200);
    expect(new Set(PROFESSIONS_SENEGAL.map((row) => row.code)).size).toBe(
      PROFESSIONS_SENEGAL.length,
    );
    expect(new Set(PROFESSIONS_SENEGAL.map((row) => row.label)).size).toBe(
      PROFESSIONS_SENEGAL.length,
    );
  });

  it('identifie les métiers qui autorisent un syndicat enseignant', () => {
    expect(PROFESSIONS_SENEGAL.find((row) => row.label === 'Instituteur')?.isTeaching).toBe(true);
    expect(PROFESSIONS_SENEGAL.find((row) => row.label === 'Comptable')?.isTeaching).toBe(false);
  });
});
