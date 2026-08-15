import { describe, expect, it } from 'vitest';

import { breakingStageIndex, type FunnelStage } from '@/lib/data/funnel';
import { formatXof } from '@/lib/money';

/**
 * L'entonnoir est le seul écran du panel qui affiche de l'ARGENT à la
 * direction. Deux propriétés comptent plus que le reste :
 *
 *  1. le montant ne devient jamais un `number`, à aucun moment du trajet ;
 *  2. la marche où la chaîne se casse est désignée par un fait, pas par un
 *     seuil inventé.
 *
 * La première n'est plus vérifiée par un validateur écrit à la main : le contrat
 * engendré déclare `string`, et le compilateur refuse désormais un `number` à
 * chaque point de passage. Il reste à prouver que le CHEMIN D'AFFICHAGE tient la
 * promesse sur un montant que `Number` ne saurait pas porter, ce que fait le
 * premier test ci-dessous.
 */

/** Espace insécable étroit : le séparateur de milliers du français. */
const NB = '\u202f';

const stage = (
  label: string,
  count: number,
  precedente: number | null,
  global: number | null = precedente,
): FunnelStage => ({
  label,
  count,
  tauxEtapePrecedente: precedente,
  tauxGlobal: global,
});

describe('montants de l’entonnoir', () => {
  it('affiche sans perte un montant qui dépasse la précision d’un nombre JSON', () => {
    // 18 chiffres : la borne exacte de la colonne `Decimal(18,0)`.
    const huge = '999999999999999999';

    expect(formatXof(huge)).toBe(`999${NB}999${NB}999${NB}999${NB}999${NB}999 FCFA`);
    // La preuve de ce qu'on évite : la voie flottante ment d'une unité.
    expect(String(Number(huge))).not.toBe(huge);
  });
});

describe('breakingStageIndex', () => {
  it('désigne l’ouverture de dossier sur le jeu de référence', () => {
    // 43,2 % tient, 6,3 % casse. Le taux global de 2,7 % masquerait la marche.
    const stages = [
      stage('Prospects saisis', 37, 100, 100),
      stage('Méthode obtenue', 16, 43.2, 43.2),
      stage('Dossier ouvert', 1, 6.3, 2.7),
      stage('Dossier encaissé', 1, 100, 2.7),
    ];
    expect(breakingStageIndex(stages)).toBe(2);
  });

  it('ignore la première marche, qui vaut 100 % par construction', () => {
    const stages = [stage('A', 10, 100), stage('B', 9, 90), stage('C', 8, 88.9)];
    expect(breakingStageIndex(stages)).toBe(2);
  });

  it('ne désigne rien quand aucune marche ne perd de population', () => {
    const stages = [stage('A', 10, 100), stage('B', 10, 100), stage('C', 10, 100)];
    expect(breakingStageIndex(stages)).toBeNull();
  });

  it('ne désigne rien en cas d’égalité : il n’y a pas UNE rupture', () => {
    const stages = [stage('A', 10, 100), stage('B', 5, 50), stage('C', 2.5, 50)];
    expect(breakingStageIndex(stages)).toBeNull();
  });

  it('ne désigne rien sur un entonnoir vide', () => {
    expect(breakingStageIndex([])).toBeNull();
    expect(breakingStageIndex([stage('A', 0, 100)])).toBeNull();
    // Sommet à zéro : les taux en dessous ne décrivent aucune population.
    expect(breakingStageIndex([stage('A', 0, 100), stage('B', 0, 0)])).toBeNull();
  });

  /**
   * Le cas que le repli `?? 0` traitait à l'envers.
   *
   * L'API rend `null` quand l'étape précédente est vide. Compté pour zéro, ce
   * `null` devenait le minimum de la série et l'écran peignait « Rupture » en
   * rouge sur une marche où il ne s'était RIEN passé, tout en masquant la vraie
   * rupture juste à côté.
   */
  it('ignore une marche sans taux au lieu de la désigner comme rupture', () => {
    const stages = [stage('A', 10, 100), stage('B', 4, 40), stage('C', 0, null)];
    expect(breakingStageIndex(stages)).toBe(1);
  });

  it('ne désigne rien quand aucune marche ne porte de taux', () => {
    const stages = [stage('A', 10, 100), stage('B', 0, null), stage('C', 0, null)];
    expect(breakingStageIndex(stages)).toBeNull();
  });
});
