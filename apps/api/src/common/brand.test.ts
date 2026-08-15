import { describe, expect, it } from 'vitest';

import { CPI_BURGUNDY, CPI_BURGUNDY_ARGB, cpiLogo, resetCpiLogoCache } from './brand.js';

/**
 * L'identité visuelle vivait en double : une constante ARGB dans l'export
 * Excel, rien du tout dans le PDF. Deux documents sortis du même produit le
 * même jour ne portaient donc pas la même couleur.
 */
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
    // En-tête PNG : le fichier est bien une image, pas un marqueur LFS ni un
    // fichier vide qu'un `COPY` incomplet aurait laissé.
    expect(logo?.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  it('MÉMORISE la lecture, y compris le fichier introuvable', () => {
    // Sans mémorisation, un logo manquant provoquerait un accès disque raté par
    // page de chaque PDF produit.
    resetCpiLogoCache();
    expect(cpiLogo()).toBe(cpiLogo());
  });
});
