import { describe, expect, it } from 'vitest';

import {
  evaluerMarques,
  marqueRecommandee,
  marquesCompatibles,
} from '@/components/accueil/tableau-de-bord/recommandation';

describe('marquesCompatibles', () => {
  it('restreint une matrice à la carte de chaleur et au tableau', () => {
    expect(marquesCompatibles('matrice')).toEqual(['carte-de-chaleur', 'tableau']);
  });
});

describe('evaluerMarques — classement', () => {
  it('recommande les barres horizontales au-delà de cinq parts et signale l’anneau', () => {
    const evaluees = evaluerMarques('classement', {
      nombreCategories: 12,
      nombrePoints: 12,
      partZero: 0,
    });
    expect(
      marqueRecommandee('classement', { nombreCategories: 12, nombrePoints: 12, partZero: 0 }),
    ).toBe('barres-horizontales');
    const anneau = evaluees.find((e) => e.marque === 'anneau');
    expect(anneau?.recommandee).toBe(false);
    expect(anneau?.raison).toMatch(/illisible au-delà de cinq parts/iu);
  });

  it('recommande l’anneau entre deux et cinq catégories', () => {
    const recommandee = marqueRecommandee('classement', {
      nombreCategories: 3,
      nombrePoints: 3,
      partZero: 0,
    });
    expect(recommandee).toBe('anneau');
    const raison = evaluerMarques('classement', {
      nombreCategories: 3,
      nombrePoints: 3,
      partZero: 0,
    }).find((e) => e.marque === 'anneau')?.raison;
    expect(raison).toMatch(/la part se lit mieux que la hauteur/iu);
  });
});

describe('evaluerMarques — série temporelle', () => {
  it('recommande la courbe au-delà de trente points et signale les barres', () => {
    const mesure = { nombreCategories: 90, nombrePoints: 90, partZero: 0 };
    expect(marqueRecommandee('serie-temporelle', mesure)).toBe('courbe');
    const barres = evaluerMarques('serie-temporelle', mesure).find(
      (e) => e.marque === 'barres-verticales',
    );
    expect(barres?.raison).toMatch(/quatre-vingt-dix barres ne se lisent pas/iu);
  });

  it('recommande les barres en dessous de dix points et signale la courbe', () => {
    const mesure = { nombreCategories: 7, nombrePoints: 7, partZero: 0 };
    expect(marqueRecommandee('serie-temporelle', mesure)).toBe('barres-verticales');
    const courbe = evaluerMarques('serie-temporelle', mesure).find((e) => e.marque === 'courbe');
    expect(courbe?.raison).toMatch(/une tendance sur sept points n’en est pas une/iu);
  });
});

describe('evaluerMarques — cyclique', () => {
  it('recommande l’aire polaire ou le radar en tête', () => {
    const mesure = { nombreCategories: 24, nombrePoints: 24, partZero: 0 };
    const tete = evaluerMarques('cyclique', mesure)[0];
    expect(['aire-polaire', 'radar']).toContain(tete?.marque);
    expect(tete?.raison).toMatch(/un cycle refermé se lit mieux/iu);
  });
});

describe('evaluerMarques — matrice', () => {
  it('ne recommande que la carte de chaleur, les autres marques sont masquées', () => {
    const mesure = { nombreCategories: 0, nombrePoints: 0, partZero: 0 };
    const evaluees = evaluerMarques('matrice', mesure);
    expect(evaluees.map((e) => e.marque)).toEqual(['carte-de-chaleur', 'tableau']);
    expect(evaluees[0]?.recommandee).toBe(true);
  });
});

describe('evaluerMarques — catégories à zéro', () => {
  it('fait remonter le tableau au-delà de 30 % de catégories à zéro', () => {
    const mesure = { nombreCategories: 10, nombrePoints: 10, partZero: 0.5 };
    const evaluees = evaluerMarques('classement', mesure);
    expect(evaluees[0]?.marque).toBe('tableau');
    expect(evaluees[0]?.raison).toMatch(/à zéro/iu);
  });

  it('ne fait rien remonter en dessous du seuil', () => {
    const mesure = { nombreCategories: 10, nombrePoints: 10, partZero: 0.1 };
    const evaluees = evaluerMarques('classement', mesure);
    expect(evaluees[0]?.marque).not.toBe('tableau');
  });
});
