import { describe, expect, it } from 'vitest';

import { breakingStageIndex, parseFunnel, type FunnelStage } from '@/lib/data/funnel';
import { formatXof } from '@/lib/money';

/**
 * L'entonnoir est le seul écran du panel qui affiche de l'ARGENT à la
 * direction. Deux propriétés comptent plus que le reste :
 *
 *  1. le montant ne devient jamais un `number`, à aucun moment du trajet ;
 *  2. la marche où la chaîne se casse est désignée par un fait, pas par un
 *     seuil inventé.
 */

const SAMPLE = {
  etapes: [
    { label: 'Prospects saisis', count: 37, tauxEtapePrecedente: 100, tauxGlobal: 100 },
    { label: 'Méthode obtenue', count: 16, tauxEtapePrecedente: 43.2, tauxGlobal: 43.2 },
    { label: 'Dossier ouvert', count: 1, tauxEtapePrecedente: 6.3, tauxGlobal: 2.7 },
    { label: 'Dossier encaissé', count: 1, tauxEtapePrecedente: 100, tauxGlobal: 2.7 },
  ],
  finance: {
    montantEncaisse: '7600000',
    montantEncaisse30Jours: '7600000',
    encaissementMoyen: '7600000',
    montantEnCours: '0',
    dossiers: 1,
    dossiersOuverts: 0,
    dossiersEncaisses: 1,
    dossiersRejetes: 0,
    tauxRejet: 0,
    delaiMoyenJours: 0,
  },
};

/** Espace insécable étroit : le séparateur de milliers du français. */
const NB = ' ';

describe('parseFunnel', () => {
  it('lit la réponse de référence', () => {
    const funnel = parseFunnel(SAMPLE);
    expect(funnel.etapes).toHaveLength(4);
    expect(funnel.etapes[2]?.tauxEtapePrecedente).toBe(6.3);
    expect(funnel.finance.montantEncaisse).toBe('7600000');
    expect(funnel.finance.delaiMoyenJours).toBe(0);
  });

  it('garde les montants en chaîne, sans conversion', () => {
    const funnel = parseFunnel(SAMPLE);
    for (const montant of [
      funnel.finance.montantEncaisse,
      funnel.finance.montantEncaisse30Jours,
      funnel.finance.encaissementMoyen,
      funnel.finance.montantEnCours,
    ]) {
      expect(typeof montant).toBe('string');
    }
  });

  it('conserve un montant qui dépasse la précision d’un nombre JSON', () => {
    // 18 chiffres : la borne exacte de la colonne `Decimal(18,0)`.
    const huge = '999999999999999999';
    const funnel = parseFunnel({
      ...SAMPLE,
      finance: { ...SAMPLE.finance, montantEncaisse: huge },
    });
    expect(funnel.finance.montantEncaisse).toBe(huge);
    expect(formatXof(funnel.finance.montantEncaisse)).toBe(
      `999${NB}999${NB}999${NB}999${NB}999${NB}999 FCFA`,
    );
    // La preuve de ce qu'on évite : la voie flottante ment d'une unité.
    expect(String(Number(huge))).not.toBe(huge);
  });

  it('REFUSE un montant émis en nombre JSON', () => {
    expect(() =>
      parseFunnel({ ...SAMPLE, finance: { ...SAMPLE.finance, montantEncaisse: 7600000 } }),
    ).toThrow(/chaîne/u);
  });

  it('accepte un délai moyen absent', () => {
    const funnel = parseFunnel({
      ...SAMPLE,
      finance: { ...SAMPLE.finance, delaiMoyenJours: null },
    });
    expect(funnel.finance.delaiMoyenJours).toBeNull();
  });

  it('échoue franchement sur une forme inattendue', () => {
    expect(() => parseFunnel(null)).toThrow();
    expect(() => parseFunnel({ etapes: {}, finance: SAMPLE.finance })).toThrow();
    expect(() => parseFunnel({ etapes: [], finance: {} })).toThrow();
  });
});

describe('breakingStageIndex', () => {
  const stage = (label: string, count: number, precedente: number): FunnelStage => ({
    label,
    count,
    tauxEtapePrecedente: precedente,
    tauxGlobal: precedente,
  });

  it('désigne l’ouverture de dossier sur le jeu de référence', () => {
    // 43,2 % tient, 6,3 % casse. Le taux global de 2,7 % masquerait la marche.
    expect(breakingStageIndex(parseFunnel(SAMPLE).etapes)).toBe(2);
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
});
