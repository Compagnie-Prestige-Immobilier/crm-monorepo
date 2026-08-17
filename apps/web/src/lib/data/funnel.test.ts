import { describe, expect, it } from 'vitest';

import { breakingStageIndex, type FunnelStage } from '@/lib/data/funnel';
import { formatXof } from '@/lib/money';

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
    const huge = '999999999999999999';

    expect(formatXof(huge)).toBe(`999${NB}999${NB}999${NB}999${NB}999${NB}999 FCFA`);
    expect(String(Number(huge))).not.toBe(huge);
  });
});

describe('breakingStageIndex', () => {
  it('désigne l’ouverture de dossier sur le jeu de référence', () => {
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
    expect(breakingStageIndex([stage('A', 0, 100), stage('B', 0, 0)])).toBeNull();
  });

  it('ignore une marche sans taux au lieu de la désigner comme rupture', () => {
    const stages = [stage('A', 10, 100), stage('B', 4, 40), stage('C', 0, null)];
    expect(breakingStageIndex(stages)).toBe(1);
  });

  it('ne désigne rien quand aucune marche ne porte de taux', () => {
    const stages = [stage('A', 10, 100), stage('B', 0, null), stage('C', 0, null)];
    expect(breakingStageIndex(stages)).toBeNull();
  });
});
