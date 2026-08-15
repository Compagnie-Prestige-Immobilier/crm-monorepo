import { describe, expect, it } from 'vitest';

import {
  BDD_SEGMENTS,
  CALL_OUTCOME_LABELS,
  CAMPAIGN_SCOPES,
  ENROLLMENT_METHOD_LABELS,
  ENROLLMENT_METHODS,
  PHASE2_STATUS_LABELS,
  PHASE2_STATUSES,
  PROSPECT_STATUT_LABELS,
  PROSPECT_STATUTS,
  REP_CALL_OUTCOME_LABELS,
  REP_CALL_OUTCOME_VARIANTS,
  SEGMENT_LABELS,
  campaignScopeLabel,
} from '@/lib/types';

/**
 * Les listes de filtre et leurs libellés doivent couvrir la MÊME énumération.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Pourquoi ce fichier existe.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les tables `Record<Enum, string>` cassent le build quand un membre est ajouté
 * au contrat : elles sont exhaustives par construction. Les LISTES, elles,
 * étaient annotées `readonly Enum[]`, ce qui accepte silencieusement un
 * sous-ensemble. Un statut ajouté demain disparaissait donc de la liste
 * déroulante sans rien casser, et les fiches qui le portent devenaient
 * introuvables : le pire des défauts, celui qui ne se voit pas.
 *
 * `types.ts` porte maintenant un contrôle À LA COMPILATION
 * (`FILTER_LISTS_ARE_EXHAUSTIVE`) qui NOMME le membre oublié. Ce fichier-ci
 * verrouille la même règle à l'exécution, en confrontant chaque liste à sa table
 * de libellés : deux mécanismes indépendants pour la même invariante, parce
 * qu'une astuce de types se contourne d'un `as` distrait.
 */

/** Comparaison d'ensembles : l'ordre des listes est un choix d'affichage. */
const sameMembers = (list: readonly string[], labels: Record<string, string>): void => {
  expect([...list].sort()).toEqual(Object.keys(labels).sort());
};

describe('exhaustivité des listes de filtre', () => {
  it('PROSPECT_STATUTS couvre tous les statuts', () => {
    sameMembers(PROSPECT_STATUTS, PROSPECT_STATUT_LABELS);
  });

  it('BDD_SEGMENTS couvre tous les segments', () => {
    sameMembers(BDD_SEGMENTS, SEGMENT_LABELS);
  });

  it('PHASE2_STATUSES couvre tous les états de phase 2', () => {
    sameMembers(PHASE2_STATUSES, PHASE2_STATUS_LABELS);
  });

  it('ENROLLMENT_METHODS couvre toutes les méthodes d’enrôlement', () => {
    sameMembers(ENROLLMENT_METHODS, ENROLLMENT_METHOD_LABELS);
  });

  it('CAMPAIGN_SCOPES ajoute « toutes bases » aux quatre segments, et rien d’autre', () => {
    // Le périmètre n'a pas de table de libellés : il en compose une à la volée.
    // La règle reste vérifiable : ALL + les segments, sans trou ni doublon.
    expect([...CAMPAIGN_SCOPES].sort()).toEqual(['ALL', ...BDD_SEGMENTS].sort());
    for (const scope of CAMPAIGN_SCOPES) {
      expect(campaignScopeLabel(scope).length).toBeGreaterThan(0);
    }
  });
});

describe('libellés des issues d’appel', () => {
  /**
   * Le détail d'une campagne représentants affichait l'énumération BRUTE : un
   * administrateur y lisait littéralement « PROSPECTS_PROMISED », alors que
   * l'écran jumeau des campagnes prospects traduit depuis toujours.
   */
  it('traduit CHAQUE issue d’appel aux représentants, sans laisser d’enum brut', () => {
    for (const [outcome, label] of Object.entries(REP_CALL_OUTCOME_LABELS)) {
      expect(label).not.toBe(outcome);
      // Un libellé français ne s'écrit pas en MAJUSCULES_AVEC_TIRETS_BAS.
      expect(label).not.toMatch(/^[A-Z_]+$/u);
    }
  });

  it('donne une couleur à chaque issue, comme les campagnes prospects', () => {
    expect(Object.keys(REP_CALL_OUTCOME_VARIANTS).sort()).toEqual(
      Object.keys(REP_CALL_OUTCOME_LABELS).sort(),
    );
  });

  it('reste distinct des issues d’appel PROSPECT : deux modules, deux vocabulaires', () => {
    // `PROSPECTS_PROMISED` (obtenir la promesse d'une liste) n'a pas
    // d'équivalent côté prospects, où l'on obtient une méthode d'enrôlement.
    expect(Object.keys(REP_CALL_OUTCOME_LABELS)).toContain('PROSPECTS_PROMISED');
    expect(Object.keys(CALL_OUTCOME_LABELS)).not.toContain('PROSPECTS_PROMISED');
  });
});
