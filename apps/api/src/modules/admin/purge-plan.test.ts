import { readFile } from 'node:fs/promises';
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

/**
 * Le schéma Prisma, seule source de vérité sur les tables existantes.
 *
 * Chemin relatif au fichier de test et non au répertoire de travail : la suite
 * s'exécute depuis `apps/api`, mais un lancement depuis la racine du dépôt ne
 * doit pas transformer ce contrôle en faux vert.
 */
const SCHEMA_PATH = new URL(
  '../../../../../packages/database/prisma/schema.prisma',
  import.meta.url,
).pathname;

/**
 * Tables volontairement HORS purge, chacune pour une raison NOMMÉE.
 *
 * Une dispense sans motif est une table oubliée qui a trouvé où se cacher : la
 * liste reste courte et commentée ligne à ligne.
 */
const PURGE_EXEMPT = new Map<string, string>([
  [
    'app_settings',
    'réglages de la plateforme (mode démo, workflow) et non données métier ; la purge les remet à zéro explicitement',
  ],
  [
    'demo_entities',
    'registre du jeu de démonstration, vidé dans la MÊME transaction par DEMO_TRACKED_STEPS',
  ],
  [
    'refresh_tokens',
    'sessions, emportées en cascade avec leur compte ; les purger seules déconnecterait tout le monde sans rien effacer',
  ],
]);

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

  /**
   * Le contrôle qui compte : la référence est le SCHÉMA, pas nous-mêmes.
   *
   * Comparer `PURGE_DOMAINS` à `PURGE_STEP_ORDER`, comme le faisait la version
   * précédente, ne peut jamais échouer sur le défaut redouté : les deux listes
   * sont écrites dans le même fichier, par la même personne, dans le même
   * geste. Une table AJOUTÉE au schéma et oubliée des deux passe inaperçue, et
   * la purge annoncée comme complète laisse ses lignes derrière elle.
   *
   * Ici la source est `schema.prisma`. Un modèle ajouté demain fait rougir ce
   * test tant qu'il n'a pas soit son étape, soit sa dispense motivée. C'est la
   * même mécanique que `demo-visibility.sweep.test.ts`.
   */
  it('couvre toutes les tables du schéma, ou les dispense avec un motif', async () => {
    const schema = await readFile(SCHEMA_PATH, 'utf8');
    const tables = [...schema.matchAll(/@@map\("([a-z_]+)"\)/g)].map((match) => match[1] ?? '');

    expect(tables.length, 'aucun @@map lu : le chemin du schéma a bougé').toBeGreaterThan(20);

    const purged = new Set(PURGE_STEP_ORDER.map((step) => PURGE_STEPS[step].table));
    const orphelines = tables.filter((table) => !purged.has(table) && !PURGE_EXEMPT.has(table));

    expect(
      orphelines.sort(),
      `Ces tables du schéma ne sont emportées par aucune étape de purge. Ajoutez ` +
        `l’étape à PURGE_STEP_ORDER et son exécution à PURGE_STEPS, ou, si la table ` +
        `ne relève délibérément pas de la purge, inscrivez-la dans PURGE_EXEMPT avec ` +
        `son motif.\n  ${orphelines.join('\n  ')}`,
    ).toEqual([]);
  });

  it('ne déclare aucune étape sur une table absente du schéma', async () => {
    const schema = await readFile(SCHEMA_PATH, 'utf8');
    const tables = new Set([...schema.matchAll(/@@map\("([a-z_]+)"\)/g)].map((match) => match[1]));

    for (const step of PURGE_STEP_ORDER) {
      expect(tables.has(PURGE_STEPS[step].table), `table inconnue : ${step}`).toBe(true);
    }
  });

  /**
   * `motif.length > 10` était vrai de toute phrase française jamais écrite : ce
   * contrôle ne pouvait pas échouer. Ce qui peut échouer, et ce qui compte, est
   * que la dispense porte sur une table QUI EXISTE. Une table renommée laisse
   * derrière elle une dispense orpheline, et le nouveau nom, lui, n'est couvert
   * par rien : la purge le laisse debout sans que personne ne le voie.
   */
  it('chaque dispense vise une table du schéma et porte un motif', async () => {
    const schema = await readFile(SCHEMA_PATH, 'utf8');
    const tables = new Set([...schema.matchAll(/@@map\("([a-z_]+)"\)/g)].map((match) => match[1]));

    const fantomes: string[] = [];
    for (const [table, motif] of PURGE_EXEMPT) {
      expect(motif.trim(), `dispense sans motif : ${table}`).not.toBe('');
      if (!tables.has(table)) fantomes.push(table);
    }

    expect(
      fantomes,
      'Ces dispenses nomment une table absente du schéma : elles ne dispensent ' +
        'plus rien, et la table qui a pris leur place n’est couverte par aucune étape.',
    ).toEqual([]);
  });

  /**
   * `expect(PURGE_STEPS[step]).toBeDefined()` était garanti par le TYPE :
   * `PURGE_STEPS` est un `Record<PurgeStepKey, PurgeStep>`, une clé manquante
   * ne compile pas. Le contrôle ne pouvait donc pas plus échouer que le
   * compilateur ne pouvait mentir. Ce qui n'est PAS garanti par le type, en
   * revanche :
   *
   *  - qu'aucune étape déclarée ne reste hors de `PURGE_STEP_ORDER`, donc
   *    jamais exécutée ;
   *  - qu'aucune table ne soit visée par deux étapes, ce qui la ferait compter
   *    deux fois dans le total annoncé avant validation.
   */
  it('exécute chaque étape déclarée, exactement une fois par table', () => {
    expect(Object.keys(PURGE_STEPS).sort()).toEqual([...PURGE_STEP_ORDER].sort());

    const parTable = new Map<string, PurgeStepKey[]>();
    for (const step of PURGE_STEP_ORDER) {
      const table = PURGE_STEPS[step].table;
      parTable.set(table, [...(parTable.get(table) ?? []), step]);
    }

    // `users` est la seule table légitimement visée par plusieurs étapes : un
    // domaine par rôle, et les rôles ne se recouvrent pas.
    const doublons = [...parTable.entries()].filter(
      ([table, steps]) => steps.length > 1 && table !== 'users',
    );
    expect(doublons).toEqual([]);
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
    // Représentants -> Prospects -> Demandes de clients, Dossiers, Tentatives,
    // File d'appels. Les demandes entrent par les prospects : une demande
    // approuvée pointe en `Restrict` vers la fiche qu'elle a produite.
    //
    // `campagnesRepresentants` entre par les représentants, et en CASCADE :
    // tâches et tentatives d'appel pendent du représentant. Sans cette arête,
    // purger les seuls représentants les emportait sans les compter, et le
    // rapport rendu à l'administrateur sous-estimait ce qui avait disparu.
    expect(expandPurgeSelection(['representants'])).toEqual([
      'representants',
      'prospects',
      'campagnesRepresentants',
      'demandesClients',
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
