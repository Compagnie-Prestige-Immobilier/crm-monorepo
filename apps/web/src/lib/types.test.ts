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
    expect([...CAMPAIGN_SCOPES].sort()).toEqual(['ALL', ...BDD_SEGMENTS].sort());
    for (const scope of CAMPAIGN_SCOPES) {
      expect(campaignScopeLabel(scope).length).toBeGreaterThan(0);
    }
  });
});

describe('libellés des issues d’appel', () => {
  it('traduit CHAQUE issue d’appel aux représentants, sans laisser d’enum brut', () => {
    for (const [outcome, label] of Object.entries(REP_CALL_OUTCOME_LABELS)) {
      expect(label).not.toBe(outcome);
      expect(label).not.toMatch(/^[A-Z_]+$/u);
    }
  });

  it('donne une couleur à chaque issue, comme les campagnes prospects', () => {
    expect(Object.keys(REP_CALL_OUTCOME_VARIANTS).sort()).toEqual(
      Object.keys(REP_CALL_OUTCOME_LABELS).sort(),
    );
  });

  it('reste distinct des issues d’appel PROSPECT : deux modules, deux vocabulaires', () => {
    expect(Object.keys(REP_CALL_OUTCOME_LABELS)).toContain('PROSPECTS_PROMISED');
    expect(Object.keys(CALL_OUTCOME_LABELS)).not.toContain('PROSPECTS_PROMISED');
  });
});
