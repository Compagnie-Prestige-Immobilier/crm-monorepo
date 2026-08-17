import { describe, expect, it } from 'vitest';

import { CPI_BURGUNDY, CPI_BURGUNDY_ARGB, cpiLogo, resetCpiLogoCache } from './brand.js';

describe('couleurs CPI', () => {
  it('dérive la notation ARGB de la valeur CSS, jamais l’inverse', () => {
    expect(CPI_BURGUNDY).toBe('#630210');
    expect(CPI_BURGUNDY_ARGB).toBe('FF630210');
    expect(CPI_BURGUNDY_ARGB).toBe(`FF${CPI_BURGUNDY.slice(1).toUpperCase()}`);
  });
});

describe('cpiLogo', () => {
  it('trouve l’asset embarqué', () => {
    resetCpiLogoCache();
    const logo = cpiLogo();
    expect(logo).not.toBeNull();
    expect(logo?.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  it('MÉMORISE la lecture, y compris le fichier introuvable', () => {
    resetCpiLogoCache();
    expect(cpiLogo()).toBe(cpiLogo());
  });
});
