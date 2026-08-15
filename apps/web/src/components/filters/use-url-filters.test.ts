import { describe, expect, it } from 'vitest';

import { isTransientPatch } from '@/components/filters/use-url-filters';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Ce que « Précédent » doit défaire, et ce qu'il ne doit pas remonter.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les trois crochets de filtre annonçaient, comme un défaut corrigé, que
 * « Précédent » défait le dernier filtre. Tout passait pourtant par
 * `router.replace`, qui n'empile RIEN : le bouton quittait l'écran, exactement
 * ce que le commentaire prétendait réparer.
 *
 * `push` partout aurait produit le défaut inverse : le champ de recherche écrit
 * à chaque frappe, et « Précédent » aurait alors remonté la saisie lettre par
 * lettre sur vingt entrées avant de sortir. C'est cette fonction qui tranche, et
 * elle est éprouvée ici parce qu'une inversion de sa condition ne se voit pas à
 * la relecture : les deux versions naviguent, l'une seulement se défait.
 */
describe('isTransientPatch', () => {
  it('une frappe de recherche REMPLACE : elle n’empile pas vingt entrées', () => {
    expect(isTransientPatch({ search: 'Diallo' })).toBe(true);
  });

  it('un critère choisi EMPILE : c’est ce que « Précédent » doit défaire', () => {
    expect(isTransientPatch({ banqueId: 'b-1' })).toBe(false);
    expect(isTransientPatch({ statut: 'CONVERTI' })).toBe(false);
    expect(isTransientPatch({ dateFrom: '2026-03-01' })).toBe(false);
    expect(isTransientPatch({ sortBy: 'createdAt' })).toBe(false);
  });

  /**
   * Changer de page est un geste unique et volontaire, pas un flux : revenir à
   * la page précédente par le bouton du navigateur est même le réflexe le plus
   * naturel sur une liste paginée.
   */
  it('la pagination EMPILE elle aussi', () => {
    expect(isTransientPatch({ page: 3 })).toBe(false);
  });

  /**
   * Le cas qui compte le plus : une frappe accompagnée d'un autre critère n'est
   * plus une frappe. Traiter le lot comme transitoire perdrait l'entrée du
   * critère, qui est la seule chose qu'on voulait pouvoir défaire.
   */
  it('un lot MIXTE empile, parce qu’il porte un vrai critère', () => {
    expect(isTransientPatch({ search: 'Diallo', banqueId: 'b-1' })).toBe(false);
  });

  it('un patch vide ne navigue vers rien de nouveau', () => {
    expect(isTransientPatch({})).toBe(true);
  });
});
