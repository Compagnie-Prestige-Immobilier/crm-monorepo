import type { Projet } from '@/lib/types';

type Filtres = Record<string, unknown>;

/** Clés de cache des listes, détails et tableaux de bord. Reprises de la v1. */
export const queryKeys = {
  session: ['session'] as const,
  reference: ['reference'] as const,

  prospectsRoot: ['prospects'] as const,
  prospects: (filtres: Filtres) => ['prospects', filtres] as const,
  prospect: (id: string) => ['prospects', 'detail', id] as const,

  dashboardRoot: ['dashboard'] as const,
  dashboard: (filtres: Filtres) => ['dashboard', filtres] as const,

  funnelRoot: ['funnel'] as const,
  funnel: (filtres: Filtres) => ['funnel', filtres] as const,

  representantsRoot: ['representants'] as const,
  representants: (filtres: Filtres) => ['representants', filtres] as const,
  representant: (id: string) => ['representants', 'detail', id] as const,

  commerciauxRoot: ['commerciaux'] as const,
  commerciaux: (filtres: Filtres) => ['commerciaux', filtres] as const,

  referentielsRoot: ['referentiels'] as const,
  banques: ['referentiels', 'banques'] as const,
  syndicats: ['referentiels', 'syndicats'] as const,
  incomeBands: ['referentiels', 'incomeBands'] as const,
  departements: ['referentiels', 'departements'] as const,
  iefs: ['referentiels', 'iefs'] as const,
  regions: ['referentiels', 'regions'] as const,
  referentielUsage: ['referentiels', 'usage'] as const,
  /** Ce que la saisie propose : actifs seulement. */
  statutsQualification: ['referentiels', 'statutsQualification'] as const,
  /** Ce que l'administration montre : tout, désactivés compris. */
  statutsQualificationAdmin: ['referentiels', 'statutsQualification', 'administration'] as const,

  visitesRoot: ['visites'] as const,
  visiteReferentielsRoot: ['visites', 'referentiels'] as const,
  visiteReferentiel: (kind: string) => ['visites', 'referentiels', kind] as const,
  visiteReferentielUsage: ['visites', 'referentiels', 'usage'] as const,
  visitesStats: (du: string, au: string) => ['visites', 'stats', du, au] as const,
  disposition: (ecran: string) => ['tableau-de-bord', 'disposition', ecran] as const,
  visitesImport: (id: string) => ['visites', 'import', id] as const,
  visitesImportRevue: (id: string, page: number) =>
    ['visites', 'import', id, 'revue', page] as const,

  /** La fiche que l'appelant a en main : lue par la barre supérieure, écrite par les consoles. */
  ouvertureCourante: ['ouvertures', 'courante'] as const,

  /** Écrans téléconseiller : rappels promis, numéros suggérés, fiches déjà appelées. */
  callbacksRoot: ['callbacks'] as const,
  callbacks: (scope: string, projet: string, appeleParId: string | null) =>
    ['callbacks', scope, projet, appeleParId] as const,
  suggestionsRoot: ['suggestions'] as const,
  suggestions: (statut: string | null) => ['suggestions', statut ?? 'tous'] as const,
  mesContacts: (quoi: string, projet: string, appeleParId: string) =>
    ['mes-contacts', quoi, projet, appeleParId] as const,
  representantsAQualifier: (filtres: Filtres) => ['representants', 'a-qualifier', filtres] as const,
  representantsSuivi: (suivi: string, appeleParId: string | null) =>
    ['representants', 'suivi', suivi, appeleParId] as const,
  appelsRepresentant: (id: string) => ['representants', 'detail', id, 'appels'] as const,
  lotsExportRoot: ['lots-export'] as const,
  lotsExport: (filtres: Filtres = {}) => ['lots-export', filtres] as const,
  lotsExportDetail: (id: string) => ['lots-export', 'detail', id] as const,
  lotsExportApercu: (critere: Filtres) => ['lots-export', 'apercu', critere] as const,
  lotsExportTeleconseillers: ['lots-export', 'teleconseillers'] as const,
  lotsExportFiches: (id: string, filtres: Filtres = {}) =>
    ['lots-export', 'detail', id, 'fiches', filtres] as const,
  parametresChues: ['parametres-chues'] as const,
  parametresChuesJournal: ['parametres-chues', 'journal'] as const,

  bankCasesRoot: ['bank-cases'] as const,
  bankCases: (filtres: Filtres) => ['bank-cases', filtres] as const,
  bankCase: (id: string, projet: Projet) => ['bank-cases', 'detail', id, projet] as const,
  bankAnalyticsRoot: ['bank-analytics'] as const,
  bankAnalytics: (filtres: Filtres) => ['bank-analytics', filtres] as const,
  bankStagesRoot: ['bank-stages'] as const,
  bankStages: (includeInactive: boolean) => ['bank-stages', includeInactive] as const,
  bankRejectionReasons: ['bank-rejection-reasons'] as const,

  clientRequestsRoot: ['client-requests'] as const,
  clientRequests: (filtres: Filtres) => ['client-requests', filtres] as const,

  /** La racine invalide la cloche et ses pages ; `inbox` lit la cloche. */
  inboxRoot: ['inbox'] as const,
  inbox: ['inbox'] as const,
  inboxPage: (page: number, unreadOnly: boolean) => ['inbox', 'page', page, unreadOnly] as const,

  champsConversionRoot: ['champs-conversion'] as const,
  champsConversion: (projet: Projet) => ['champs-conversion', projet] as const,
  purgeCatalog: ['purge-catalog'] as const,
  supervision: ['supervision'] as const,

  /** Racine partagée : appliquer une simulation change le suivi et l'historique. */
  importsRoot: ['imports'] as const,
  importJobs: (page: number) => ['imports', 'page', page] as const,
  importJob: (id: string) => ['imports', 'detail', id] as const,

  /** Export intégral de la base : sondé pendant que `pg_dump` tourne. */
  databaseDump: ['database-dump'] as const,

  statsRoot: ['stats'] as const,
  statsTeleconseil: (filtres: Filtres) => ['stats', 'teleconseil', filtres] as const,
  /** Des clés séparées évitent de coupler les volets lourds au rafraîchissement live. */
  statsCampagnes: (filtres: Filtres) => ['stats', 'campagnes', filtres] as const,
  statsDelais: (filtres: Filtres) => ['stats', 'delais', filtres] as const,
  statsCohortes: (filtres: Filtres) => ['stats', 'cohortes', filtres] as const,
  statsRepresentants: (filtres: Filtres) => ['stats', 'representants', filtres] as const,
  statsQualite: (filtres: Filtres) => ['stats', 'qualite', filtres] as const,
  statsRendement: (filtres: Filtres) => ['stats', 'rendement', filtres] as const,
  statsProvenance: (filtres: Filtres) => ['stats', 'provenance', filtres] as const,
  statsVieillissement: (filtres: Filtres) => ['stats', 'vieillissement', filtres] as const,
  statsAmbassadeurs: (filtres: Filtres) => ['stats', 'ambassadeurs', filtres] as const,

  enrolementRoot: ['enrolement'] as const,
  enrolementInscriptions: (projet: string, filtres: Filtres) =>
    ['enrolement', 'inscriptions', projet, filtres] as const,
  enrolementIndicateurs: (projet: string, filtres: Filtres) =>
    ['enrolement', 'indicateurs', projet, filtres] as const,
  enrolementReglages: (projet: string) => ['enrolement', 'reglages', projet] as const,
};
