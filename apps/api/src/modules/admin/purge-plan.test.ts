import { describe, expect, it } from 'vitest';

import {
  PURGE_DOMAINS,
  PURGE_DOMAIN_KEYS,
  PURGE_STEP_ORDER,
  expandPurgeSelection,
  isPurgeDomainKey,
  purgeDomain,
  purgeSteps,
  type PurgeDomainKey,
  type PurgeStepKey,
} from './purge-plan.js';
import { PURGE_STEPS } from './purge-steps.js';

/**
 * Le plan de purge est la seule pièce du dispositif qui décide de CE QUI est
 * supprimé et DANS QUEL ORDRE. Une erreur ici ne produit pas un écran fautif,
 * elle produit une base incohérente ou une transaction en échec.
 */

/** Sous-mot : `sequence` apparaît-elle dans `reference`, dans le même ordre ? */
function isSubsequenceOf(
  sequence: readonly PurgeStepKey[],
  reference: readonly PurgeStepKey[],
): boolean {
  let cursor = 0;
  for (const step of sequence) {
    const index = reference.indexOf(step, cursor);
    if (index === -1) return false;
    cursor = index + 1;
  }
  return true;
}

describe('catalogue des domaines', () => {
  it('couvre toutes les clés annoncées, une fois chacune', () => {
    expect(PURGE_DOMAINS.map((domain) => domain.key).sort()).toEqual([...PURGE_DOMAIN_KEYS].sort());
  });

  it('n’attribue jamais la même étape à deux domaines', () => {
    const seen = new Set<PurgeStepKey>();
    for (const domain of PURGE_DOMAINS) {
      for (const step of domain.steps) {
        expect(seen.has(step)).toBe(false);
        seen.add(step);
      }
    }
  });

  it('couvre l’intégralité de PURGE_STEP_ORDER', () => {
    const covered = PURGE_DOMAINS.flatMap((domain) => [...domain.steps]).sort();
    expect(covered).toEqual([...PURGE_STEP_ORDER].sort());
  });

  it('sait exécuter chaque étape déclarée', () => {
    // Une étape ajoutée à l'ordre sans son exécution laisserait des lignes
    // derrière une purge annoncée comme complète.
    for (const step of PURGE_STEP_ORDER) {
      expect(PURGE_STEPS[step]).toBeDefined();
      expect(PURGE_STEPS[step].table).not.toBe('');
    }
  });

  it('ne dépend que de domaines existants', () => {
    for (const domain of PURGE_DOMAINS) {
      for (const required of domain.requires) {
        expect(isPurgeDomainKey(required)).toBe(true);
      }
    }
  });

  it('reconnaît une clé inconnue', () => {
    expect(isPurgeDomainKey('administrateurs')).toBe(false);
    expect(() => purgeDomain('administrateurs' as PurgeDomainKey)).toThrow();
  });
});

describe('fermeture de la sélection', () => {
  it('entraîne les dépendances transitivement', () => {
    // Représentants → Prospects → Dossiers, Tentatives, File d'appels.
    expect(expandPurgeSelection(['representants'])).toEqual([
      'representants',
      'prospects',
      'fileAppels',
      'tentatives',
      'dossiers',
    ]);
  });

  it('rend un ordre stable, indépendant de celui des cases cochées', () => {
    const a = expandPurgeSelection(['dossiers', 'prospects']);
    const b = expandPurgeSelection(['prospects', 'dossiers']);
    expect(a).toEqual(b);
  });

  it('est idempotente', () => {
    const once = expandPurgeSelection(['teleconseillers']);
    expect(expandPurgeSelection(once)).toEqual(once);
  });

  it('emporte tout le métier quand on retire les comptes téléconseillers', () => {
    const expanded = expandPurgeSelection(['teleconseillers']);
    expect(expanded).toContain('prospects');
    expect(expanded).toContain('representants');
    expect(expanded).toContain('campagnes');
    expect(expanded).toContain('dossiers');
    // Mais PAS les référentiels : ils ne portent aucune clé vers un compte.
    expect(expanded).not.toContain('referentiels');
  });

  it('ne touche à rien d’autre pour un domaine feuille', () => {
    expect(expandPurgeSelection(['journal'])).toEqual(['journal']);
    expect(expandPurgeSelection(['synchronisation'])).toEqual(['synchronisation']);
  });
});

describe('séquence d’étapes', () => {
  it('reste un sous-mot de l’ordre global, quelle que soit la sélection', () => {
    // La propriété qui garantit le respect des clés étrangères : si la
    // séquence produite suit toujours l'ordre global, elle supprime toujours
    // les enfants avant les parents.
    for (const key of PURGE_DOMAIN_KEYS) {
      expect(isSubsequenceOf(purgeSteps([key]), PURGE_STEP_ORDER)).toBe(true);
    }
    expect(isSubsequenceOf(purgeSteps([...PURGE_DOMAIN_KEYS]), PURGE_STEP_ORDER)).toBe(true);
  });

  it('supprime les dossiers avant les prospects qui les portent', () => {
    const steps = purgeSteps(['prospects']);
    expect(steps.indexOf('bankCases')).toBeLessThan(steps.indexOf('prospects'));
    expect(steps.indexOf('bankCaseTransitions')).toBeLessThan(steps.indexOf('bankCases'));
  });

  it('supprime les prospects et les représentants avant les comptes', () => {
    const steps = purgeSteps(['teleconseillers']);
    expect(steps.indexOf('prospects')).toBeLessThan(steps.indexOf('commercialAccounts'));
    expect(steps.indexOf('representants')).toBeLessThan(steps.indexOf('commercialAccounts'));
    expect(steps.indexOf('campaignMembers')).toBeLessThan(steps.indexOf('commercialAccounts'));
  });

  it('supprime les départements avant les régions', () => {
    const steps = purgeSteps(['referentiels']);
    expect(steps.indexOf('departements')).toBeLessThan(steps.indexOf('regions'));
    expect(steps.indexOf('banques')).toBeLessThan(steps.indexOf('regions'));
  });

  it('« Tout sélectionner » couvre exactement l’ordre global', () => {
    expect(purgeSteps([...PURGE_DOMAIN_KEYS])).toEqual([...PURGE_STEP_ORDER]);
  });

  it('ne produit aucune étape pour une sélection vide', () => {
    expect(purgeSteps([])).toEqual([]);
  });
});
