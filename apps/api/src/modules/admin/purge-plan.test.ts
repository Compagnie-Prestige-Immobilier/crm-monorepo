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

const SCHEMA_PATH = new URL(
  '../../../../../packages/database/prisma/schema.prisma',
  import.meta.url,
).pathname;

const PURGE_EXEMPT = new Map<string, string>([
  ['app_settings', 'réglages de workflow et non données métier'],
  [
    'refresh_tokens',
    'sessions, emportées en cascade avec leur compte ; les purger seules déconnecterait tout le monde sans rien effacer',
  ],
  [
    'segment_changes',
    'histoire des bascules de segment, emportée en CASCADE avec le prospect qu’elle décrit ; `changedById` pointe vers `users` en Restrict, mais le domaine « Comptes téléconseillers » entraîne déjà « Prospects », qui les fait toutes partir avant les comptes',
  ],
  [
    'representant_relation_changes',
    'histoire des bascules de relation, emportée en CASCADE avec le représentant qu’elle décrit ; `changedById` pointe vers `users` en Restrict, mais le domaine « Comptes téléconseillers » entraîne déjà « Représentants », qui les fait toutes partir avant les comptes',
  ],
  [
    'representant_comments',
    'fil de commentaires, emporté en CASCADE avec le représentant qu’il commente ; `authorId` pointe vers `users` en Restrict, mais le domaine « Comptes téléconseillers » entraîne déjà « Représentants », qui les fait tous partir avant les comptes',
  ],
  [
    'import_jobs',
    'journal des dépôts d’import : il décrit un GESTE d’administration, pas une donnée métier. Purger le domaine « Prospects » n’efface pas la trace qu’un classeur a été déposé un jour, de la même façon que la purge ne réécrit pas le journal d’audit. Les lignes s’effacent d’elles-mêmes par `expiresAt`, et `requestedById` pointe vers `users` en Restrict : le compte demandeur ne peut pas partir en laissant un travail orphelin',
  ],
  [
    'agent_heartbeats',
    'trace de présence, UNE ligne par compte, en `onDelete: Cascade` : elle part avec le compte, et la réécrire suffit à la remettre à jour. Lui donner une étape à elle seule effacerait des lignes qui renaissent au pull suivant, tout en faisant paraître « jamais vu » des comptes toujours en service',
  ],
  [
    'agent_activity_days',
    'temps de présence observé, une ligne par compte et par journée, en `onDelete: Cascade` : elle part avec le compte. Comme `agent_heartbeats`, elle mesure la présence de l’application, pas une donnée métier, et lui donner une étape à elle seule effacerait le temps de travail de comptes toujours en service',
  ],
  [
    'device_tokens',
    'sous-système push retiré : aucun code n’écrit plus cette table, conservée une version pour que la mise à jour reste réversible (docs/migrations-en-attente.md), et emportée en cascade avec son compte',
  ],
  [
    'dashboard_layouts',
    'préférence d’affichage, UNE ligne par compte et par écran, en `onDelete: Cascade` : elle décrit la façon dont quelqu’un range son écran, pas une donnée métier. La purger effacerait la composition des chiffres d’une directrice qui n’a rien demandé, et le compte, lui, l’emporte déjà en partant',
  ],
  [
    'android_releases',
    'catalogue de distribution de l’application : il décrit les APK publiés et le plancher de version du parc, pas une donnée métier. La purger couperait la mise à jour des téléphones ; `publishedById` part en SetNull avec le compte qui a publié',
  ],
  [
    'visite_import_changes',
    'différentiel d’un aller-retour Excel, emporté en CASCADE avec le travail d’import qu’il décrit. `import_jobs` est lui-même dispensé pour la même raison : il décrit un GESTE d’administration et s’efface de lui-même par `expiresAt`',
  ],
]);

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

  it('exécute chaque étape déclarée, exactement une fois par table', () => {
    expect(Object.keys(PURGE_STEPS).sort()).toEqual([...PURGE_STEP_ORDER].sort());

    const parTable = new Map<string, PurgeStepKey[]>();
    for (const step of PURGE_STEP_ORDER) {
      const table = PURGE_STEPS[step].table;
      parTable.set(table, [...(parTable.get(table) ?? []), step]);
    }

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
    expect(() => purgeDomain('administrateurs' as PurgeDomainKey)).toThrow(
      'Domaine de purge inconnu : administrateurs',
    );
  });
});

describe('fermeture de la sélection', () => {
  it('entraîne les dépendances transitivement', () => {
    expect(expandPurgeSelection(['representants'])).toEqual([
      'representants',
      'prospects',
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
    expect(expanded).toContain('dossiers');
    expect(expanded).not.toContain('referentiels');
  });

  it('ne touche à rien d’autre pour un domaine feuille', () => {
    expect(expandPurgeSelection(['journal'])).toEqual(['journal']);
    expect(expandPurgeSelection(['synchronisation'])).toEqual(['synchronisation']);
  });
});

describe('séquence d’étapes', () => {
  it('reste un sous-mot de l’ordre global, quelle que soit la sélection', () => {
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
    expect(steps.indexOf('scheduledCallbacks')).toBeLessThan(steps.indexOf('commercialAccounts'));
  });

  it('supprime les rappels planifiés avant les prospects et les comptes', () => {
    const steps = purgeSteps([...PURGE_DOMAIN_KEYS]);
    expect(steps.indexOf('scheduledCallbacks')).toBeLessThan(steps.indexOf('prospects'));
    expect(steps.indexOf('scheduledCallbacks')).toBeLessThan(steps.indexOf('commercialAccounts'));
  });

  it('emporte les rappels planifiés avec les comptes téléconseillers', () => {
    expect(purgeSteps(['teleconseillers'])).toContain('scheduledCallbacks');
  });

  it('supprime les numéros suggérés avant la tentative qui les a recueillis', () => {
    const steps = purgeSteps([...PURGE_DOMAIN_KEYS]);
    expect(steps.indexOf('repSuggestions')).toBeLessThan(steps.indexOf('repCallAttempts'));
    expect(steps.indexOf('repSuggestions')).toBeLessThan(steps.indexOf('representants'));
    expect(steps.indexOf('repSuggestions')).toBeLessThan(steps.indexOf('commercialAccounts'));
  });

  it('emporte les numéros suggérés avec les comptes téléconseillers', () => {
    // `suggestedById` pointe vers `users` en Restrict : sans cette étape, la purge
    // des comptes échouerait sur la contrainte au lieu de s'exécuter.
    expect(purgeSteps(['teleconseillers'])).toContain('repSuggestions');
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
