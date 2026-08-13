/**
 * Plan de purge — la partie DÉCISIONNELLE, sans Prisma.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Deux notions distinctes vivent ici, et les confondre est le piège du sujet.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. Le DOMAINE est ce que l'administrateur coche. Il parle métier :
 *    « Prospects », « Dossiers bancaires », « Comptes téléconseillers ».
 *
 * 2. L'ÉTAPE est une suppression sur UNE table. `PURGE_STEP_ORDER` fixe l'ordre
 *    de toutes les étapes du système, enfants avant parents. Une purge n'est
 *    jamais qu'un SOUS-ENSEMBLE de cette séquence, parcouru dans le même sens.
 *
 * L'ordre est donc décidé une seule fois, globalement, et non recalculé par
 * combinaison de cases cochées. C'est ce qui rend la propriété testable : quelle
 * que soit la sélection, la séquence produite reste un sous-mot de
 * `PURGE_STEP_ORDER`, donc reste compatible avec les clés étrangères.
 *
 * `requires` ne recopie PAS le graphe complet des relations : il ne porte que
 * les arêtes `onDelete: Restrict`, les seules qui font échouer une suppression.
 * Les arêtes `Cascade` sont assurées par PostgreSQL et les arêtes `SetNull` ne
 * bloquent rien. Élargir `requires` au-delà de ces arêtes reviendrait à
 * supprimer des données que l'administrateur n'a pas demandées — ce qui est le
 * seul défaut irrattrapable d'un écran comme celui-ci.
 */

/**
 * Toutes les suppressions du système, enfants d'abord.
 *
 * Relire le schéma avant d'y toucher : une étape déplacée au-dessus de son
 * parent produit une violation de clé étrangère, donc un retour arrière complet
 * de la transaction.
 */
export const PURGE_STEP_ORDER = [
  'bankCaseTransitions',
  'bankCases',
  'callAttempts',
  'callTasks',
  'campaignMembers',
  'campaigns',
  'prospects',
  'representants',
  'notificationDeliveries',
  'notifications',
  'notificationTemplates',
  'deviceTokens',
  'syncOperations',
  'syncBatches',
  'auditLogs',
  'commercialAccounts',
  'financeAccounts',
  'bankCaseStages',
  'bankRejectionReasons',
  'banques',
  'syndicats',
  'departements',
  'regions',
] as const;

export type PurgeStepKey = (typeof PURGE_STEP_ORDER)[number];

export const PURGE_DOMAIN_KEYS = [
  'teleconseillers',
  'finances',
  'representants',
  'prospects',
  'campagnes',
  'fileAppels',
  'tentatives',
  'dossiers',
  'notifications',
  'synchronisation',
  'journal',
  'referentiels',
] as const;

export type PurgeDomainKey = (typeof PURGE_DOMAIN_KEYS)[number];

export interface PurgeDomain {
  readonly key: PurgeDomainKey;
  /** Ce que l'administrateur lit sur la case à cocher. Il nomme, il n'explique pas. */
  readonly label: string;
  /** Une phrase, au plus, quand le libellé seul laisserait un doute sur le périmètre. */
  readonly hint: string;
  /** Étapes portées par ce domaine, dans l'ordre global. */
  readonly steps: readonly PurgeStepKey[];
  /**
   * Domaines entraînés, parce qu'ils portent une clé étrangère `Restrict` vers
   * celui-ci. Cocher l'un coche les autres : la transaction échouerait sinon.
   */
  readonly requires: readonly PurgeDomainKey[];
}

export const PURGE_DOMAINS: readonly PurgeDomain[] = [
  {
    key: 'dossiers',
    label: 'Dossiers bancaires',
    hint: 'Dossiers et leur historique d’étapes.',
    steps: ['bankCaseTransitions', 'bankCases'],
    requires: [],
  },
  {
    key: 'tentatives',
    label: 'Tentatives d’appel',
    hint: 'Historique des appels passés.',
    steps: ['callAttempts'],
    requires: [],
  },
  {
    key: 'fileAppels',
    label: 'File d’appels',
    hint: 'Numéros attribués, appelés ou non.',
    steps: ['callTasks'],
    requires: [],
  },
  {
    key: 'campagnes',
    label: 'Campagnes d’appels',
    hint: 'Campagnes et leur répartition entre téléconseillers.',
    steps: ['campaignMembers', 'campaigns'],
    requires: ['fileAppels'],
  },
  {
    key: 'prospects',
    label: 'Prospects',
    hint: 'Fiches prospects, y compris l’annuaire répliqué sur mobile.',
    steps: ['prospects'],
    requires: ['dossiers', 'tentatives', 'fileAppels'],
  },
  {
    key: 'representants',
    label: 'Représentants',
    hint: 'Fiches représentants.',
    steps: ['representants'],
    requires: ['prospects'],
  },
  {
    key: 'notifications',
    label: 'Notifications',
    hint: 'Envois, accusés, gabarits et appareils enregistrés.',
    steps: [
      'notificationDeliveries',
      'notifications',
      'notificationTemplates',
      'deviceTokens',
    ],
    requires: [],
  },
  {
    key: 'synchronisation',
    label: 'Journal de synchronisation',
    hint: 'Lots reçus des appareils mobiles.',
    steps: ['syncOperations', 'syncBatches'],
    requires: [],
  },
  {
    key: 'journal',
    label: 'Journal d’audit',
    hint: 'Traces des actions administratives.',
    steps: ['auditLogs'],
    requires: [],
  },
  {
    key: 'teleconseillers',
    label: 'Comptes téléconseillers',
    hint: 'Comptes et tout ce qu’ils ont saisi.',
    steps: ['commercialAccounts'],
    requires: [
      'dossiers',
      'tentatives',
      'fileAppels',
      'campagnes',
      'prospects',
      'representants',
    ],
  },
  {
    key: 'finances',
    label: 'Comptes Finances générales',
    hint: 'Comptes du pôle et dossiers qu’ils ont ouverts.',
    steps: ['financeAccounts'],
    requires: ['dossiers'],
  },
  {
    key: 'referentiels',
    label: 'Référentiels',
    hint: 'Régions, départements, banques, syndicats, étapes et motifs de rejet.',
    steps: [
      'bankCaseStages',
      'bankRejectionReasons',
      'banques',
      'syndicats',
      'departements',
      'regions',
    ],
    requires: ['dossiers', 'prospects', 'representants'],
  },
];

const BY_KEY = new Map<PurgeDomainKey, PurgeDomain>(
  PURGE_DOMAINS.map((domain) => [domain.key, domain]),
);

export function purgeDomain(key: PurgeDomainKey): PurgeDomain {
  const domain = BY_KEY.get(key);
  // Impossible via le contrôleur : le DTO valide les clés contre l'énumération.
  if (!domain) throw new Error(`Domaine de purge inconnu : ${key}`);
  return domain;
}

export function isPurgeDomainKey(value: string): value is PurgeDomainKey {
  return BY_KEY.has(value as PurgeDomainKey);
}

/**
 * Ferme la sélection sur ses dépendances, transitivement.
 *
 * Cocher « Représentants » entraîne « Prospects », qui entraîne à son tour
 * « Dossiers bancaires », « Tentatives d'appel » et « File d'appels ». L'écran
 * affiche exactement cette fermeture AVANT la validation : une case qui
 * s'allume toute seule au moment de la suppression serait vécue comme une
 * dérive, et à raison.
 *
 * Le résultat est trié dans l'ordre de `PURGE_DOMAIN_KEYS` pour que deux
 * sélections équivalentes produisent la même réponse — sans quoi le récapitulatif
 * changerait d'ordre selon celui des cases cochées.
 */
export function expandPurgeSelection(
  selection: readonly PurgeDomainKey[],
): readonly PurgeDomainKey[] {
  const resolved = new Set<PurgeDomainKey>();
  const pending = [...selection];

  while (pending.length > 0) {
    const key = pending.pop();
    if (key === undefined || resolved.has(key)) continue;
    resolved.add(key);
    pending.push(...purgeDomain(key).requires);
  }

  return PURGE_DOMAIN_KEYS.filter((key) => resolved.has(key));
}

/**
 * Étapes à exécuter, dans l'ordre global.
 *
 * Le filtre part de `PURGE_STEP_ORDER` et non des domaines : c'est ce qui
 * garantit que l'ordre des clés étrangères ne dépend jamais de l'ordre dans
 * lequel l'administrateur a coché ses cases.
 */
export function purgeSteps(selection: readonly PurgeDomainKey[]): readonly PurgeStepKey[] {
  const wanted = new Set<PurgeStepKey>(
    expandPurgeSelection(selection).flatMap((key) => [...purgeDomain(key).steps]),
  );
  return PURGE_STEP_ORDER.filter((step) => wanted.has(step));
}
