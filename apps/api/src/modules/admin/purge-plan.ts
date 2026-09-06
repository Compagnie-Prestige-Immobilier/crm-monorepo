// ORDRE GLOBAL, enfants avant parents ; toute purge en est un sous-mot. Déplacer une étape
// au-dessus de son parent viole une clé étrangère et annule la transaction entière.
export const PURGE_STEP_ORDER = [
  'bankCaseTransitions',
  'bankCases',
  // Avant `commercialAccounts` : une détection pointe son téléconseiller en
  // Restrict, et sa fiche en cascade.
  'deviceCallDetections',
  // Avant `commercialAccounts` : une ouverture pointe son teleconseiller et son
  // liberateur en Restrict, et sa fiche en cascade.
  'ouverturesFiche',
  'callAttempts',
  // Avant `commercialAccounts` : une reaffectation pointe son beneficiaire et
  // son auteur en Restrict, et sa campagne en cascade.
  'lotExportReaffectations',
  'lotExportItems',
  'lotsExport',
  // Avant `commercialAccounts` : un rappel planifié pointe son téléconseiller
  // en Restrict, et son prospect en cascade.
  'scheduledCallbacks',
  // Avant `repCallAttempts` : la suggestion pend de la tentative en CASCADE.
  'repSuggestions',
  'repCallAttempts',
  'clientRequests',
  'visites',
  'prospectConversions',
  'prospectJourneys',
  'prospects',
  'representants',
  'notificationDeliveries',
  'notifications',
  'notificationTemplates',
  'syncOperations',
  'syncBatches',
  'auditLogs',
  'commercialAccounts',
  'chargeClienteleAccounts',
  'financeAccounts',
  'supervisionAccounts',
  'directionAccounts',
  'accueilAccounts',
  'bankCaseStages',
  'bankRejectionReasons',
  'callOutcomeReasons',
  'visiteEntreprises',
  'visiteDirections',
  'visiteDestinataires',
  'visiteObjets',
  'canauxProvenance',
  'offres',
  'tranchesRevenu',
  'professions',
  'employeurs',
  'pays',
  'banques',
  'syndicats',
  'iefs',
  'departements',
  'regions',
] as const;

export type PurgeStepKey = (typeof PURGE_STEP_ORDER)[number];

export const PURGE_DOMAIN_KEYS = [
  'teleconseillers',
  'chargesClientele',
  'finances',
  'supervision',
  'directionAccueil',
  'representants',
  'prospects',
  'lotsExport',
  'demandesClients',
  'visites',
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
  readonly label: string;
  readonly hint: string;
  readonly steps: readonly PurgeStepKey[];
  // Ne porte QUE les arêtes `onDelete: Restrict`, seules à faire échouer une suppression.
  // L'élargir supprimerait des données que l'administrateur n'a pas cochées.
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
    hint: 'Appels consignés, appels seulement vus par le téléphone, et ouvertures de fiche.',
    steps: [
      'repSuggestions',
      'repCallAttempts',
      'callAttempts',
      'deviceCallDetections',
      'ouverturesFiche',
    ],
    requires: [],
  },
  {
    key: 'fileAppels',
    label: 'File d’appels',
    hint: 'Numéros attribués, appelés ou non, et les rappels planifiés.',
    steps: ['scheduledCallbacks'],
    requires: [],
  },
  {
    key: 'lotsExport',
    label: 'Campagnes',
    hint: 'Campagnes de fiches réparties pour le terrain.',
    steps: ['lotExportReaffectations', 'lotExportItems', 'lotsExport'],
    requires: [],
  },
  {
    key: 'demandesClients',
    label: 'Demandes de création de client',
    hint: 'Demandes déposées par les banques, arbitrées ou non.',
    steps: ['clientRequests'],
    requires: [],
  },
  {
    key: 'visites',
    label: 'Registre des visites',
    hint: 'Lignes du registre d’accueil.',
    steps: ['visites'],
    requires: [],
  },
  {
    key: 'prospects',
    label: 'Prospects',
    hint: 'Fiches prospects, y compris l’annuaire répliqué sur mobile.',
    steps: ['prospectConversions', 'prospectJourneys', 'prospects'],
    requires: ['dossiers', 'tentatives', 'fileAppels', 'demandesClients'],
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
    hint: 'Envois, accusés de lecture et gabarits.',
    steps: ['notificationDeliveries', 'notifications', 'notificationTemplates'],
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
    requires: ['dossiers', 'tentatives', 'fileAppels', 'lotsExport', 'prospects', 'representants'],
  },
  {
    key: 'chargesClientele',
    label: 'Comptes chargés de clientèle',
    hint: 'Comptes du closing et tout ce qu’ils ont saisi.',
    steps: ['chargeClienteleAccounts'],
    requires: ['dossiers', 'tentatives', 'fileAppels', 'lotsExport', 'prospects', 'representants'],
  },
  {
    key: 'finances',
    label: 'Comptes Finances générales',
    hint: 'Comptes du pôle, dossiers qu’ils ont ouverts et demandes qu’ils ont déposées.',
    steps: ['financeAccounts'],
    requires: ['dossiers', 'demandesClients'],
  },
  {
    key: 'supervision',
    label: 'Comptes supervision',
    hint: 'Comptes qui suivent le travail des téléconseillers.',
    steps: ['supervisionAccounts'],
    requires: [],
  },
  {
    key: 'directionAccueil',
    label: 'Comptes direction et accueil',
    hint: 'Comptes du comptoir et de la direction commerciale, et le registre qu’ils ont tenu.',
    steps: ['directionAccounts', 'accueilAccounts'],
    // `visites` : Visite.createdBy pointe le compte en Restrict.
    requires: ['visites'],
  },
  {
    key: 'referentiels',
    label: 'Référentiels',
    hint: 'Régions, départements, IEF, banques, syndicats, étapes, motifs de rejet, issues d’appel et listes de l’accueil.',
    steps: [
      'bankCaseStages',
      'bankRejectionReasons',
      'callOutcomeReasons',
      'visiteEntreprises',
      'visiteDirections',
      'visiteDestinataires',
      'visiteObjets',
      'canauxProvenance',
      'offres',
      'tranchesRevenu',
      'professions',
      'employeurs',
      'pays',
      'banques',
      'syndicats',
      'iefs',
      'departements',
      'regions',
    ],
    requires: ['dossiers', 'prospects', 'representants', 'demandesClients', 'visites'],
  },
];

const BY_KEY = new Map<PurgeDomainKey, PurgeDomain>(
  PURGE_DOMAINS.map((domain) => [domain.key, domain]),
);

export function purgeDomain(key: PurgeDomainKey): PurgeDomain {
  const domain = BY_KEY.get(key);
  if (!domain) throw new Error(`Domaine de purge inconnu : ${key}`);
  return domain;
}

export function isPurgeDomainKey(value: string): value is PurgeDomainKey {
  return BY_KEY.has(value as PurgeDomainKey);
}

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

export function purgeSteps(selection: readonly PurgeDomainKey[]): readonly PurgeStepKey[] {
  const wanted = new Set<PurgeStepKey>(
    expandPurgeSelection(selection).flatMap((key) => [...purgeDomain(key).steps]),
  );
  return PURGE_STEP_ORDER.filter((step) => wanted.has(step));
}
