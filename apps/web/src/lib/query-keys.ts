import { bankFiltersQueryKey, type BankCaseFilters } from '@/lib/bank-filters';
import {
  clientRequestFiltersQueryKey,
  type ClientRequestFilters,
} from '@/lib/client-request-filters';
import { filtersQueryKey } from '@/lib/filters';
import { representantFiltersQueryKey, type RepresentantFilters } from '@/lib/representant-filters';
import { userFiltersQueryKey, type UserFilters } from '@/lib/user-filters';
import type { Projet, ProspectFilters } from '@/lib/types';

/** Clés de cache des listes, détails et tableaux de bord associés. */
export const queryKeys = {
  session: ['session'] as const,
  reference: ['reference'] as const,

  prospectsRoot: ['prospects'] as const,
  prospects: (filters: ProspectFilters) => ['prospects', filtersQueryKey(filters)] as const,
  prospect: (id: string) => ['prospects', 'detail', id] as const,

  dashboardRoot: ['dashboard'] as const,
  dashboard: (filters: ProspectFilters) => ['dashboard', filtersQueryKey(filters)] as const,

  /** Dérivée des mêmes filtres que les compteurs du tableau de bord. */
  funnelRoot: ['funnel'] as const,
  funnel: (filters: ProspectFilters) => ['funnel', filtersQueryKey(filters)] as const,

  representantsRoot: ['representants'] as const,
  representants: (filters: RepresentantFilters) =>
    ['representants', representantFiltersQueryKey(filters)] as const,
  representant: (id: string) => ['representants', 'detail', id] as const,

  commerciauxRoot: ['commerciaux'] as const,
  commerciaux: (filters: UserFilters) => ['commerciaux', userFiltersQueryKey(filters)] as const,

  referentielsRoot: ['referentiels'] as const,
  banques: ['referentiels', 'banques'] as const,
  syndicats: ['referentiels', 'syndicats'] as const,
  incomeBands: ['referentiels', 'incomeBands'] as const,
  departements: ['referentiels', 'departements'] as const,
  iefs: ['referentiels', 'iefs'] as const,
  regions: ['referentiels', 'regions'] as const,
  referentielUsage: ['referentiels', 'usage'] as const,
  /** Ce que la SAISIE propose : actifs seulement. */
  statutsQualification: ['referentiels', 'statutsQualification'] as const,
  /** Ce que l'ADMINISTRATION montre : tout, désactivés compris. */
  statutsQualificationAdmin: ['referentiels', 'statutsQualification', 'administration'] as const,

  // ─── Registre des visites ─────────────────────────────────────────────────
  visitesRoot: ['visites'] as const,
  visiteReferentielsRoot: ['visites', 'referentiels'] as const,
  /** Une liste entière, entrées retirées comprises : l'écran d'administration. */
  visiteReferentiel: (kind: string) => ['visites', 'referentiels', kind] as const,
  visiteReferentielUsage: ['visites', 'referentiels', 'usage'] as const,
  visitesStats: (du: string, au: string) => ['visites', 'stats', du, au] as const,
  disposition: (ecran: string) => ['tableau-de-bord', 'disposition', ecran] as const,
  visitesImport: (id: string) => ['visites', 'import', id] as const,
  visitesImportRevue: (id: string, page: number) =>
    ['visites', 'import', id, 'revue', page] as const,

  // ─── Phase 2 ──────────────────────────────────────────────────────────────
  /** La fiche que l'appelant a en main : lue par la barre supérieure, écrite par les consoles. */
  ouvertureCourante: ['ouvertures', 'courante'] as const,
  lotsExportRoot: ['lots-export'] as const,
  lotsExport: (filters: Record<string, unknown> = {}) => ['lots-export', filters] as const,
  lotsExportDetail: (id: string) => ['lots-export', 'detail', id] as const,
  lotsExportApercu: (critere: Record<string, unknown>) =>
    ['lots-export', 'apercu', critere] as const,
  lotsExportTeleconseillers: ['lots-export', 'teleconseillers'] as const,
  lotsExportFiches: (id: string, filtres: Record<string, unknown> = {}) =>
    ['lots-export', 'detail', id, 'fiches', filtres] as const,

  // ─── Banque & Finance ─────────────────────────────────────────────────────
  bankCasesRoot: ['bank-cases'] as const,
  bankCases: (filters: BankCaseFilters) => ['bank-cases', bankFiltersQueryKey(filters)] as const,
  bankCase: (id: string, projet: Projet) => ['bank-cases', 'detail', id, projet] as const,
  bankAnalyticsRoot: ['bank-analytics'] as const,
  bankAnalytics: (filters: BankCaseFilters) =>
    ['bank-analytics', bankFiltersQueryKey(filters)] as const,
  bankStagesRoot: ['bank-stages'] as const,
  bankStages: (includeInactive: boolean) => ['bank-stages', includeInactive] as const,
  bankRejectionReasons: ['bank-rejection-reasons'] as const,

  // ─── Demandes de création de client (banque → admin) ──────────────────────
  clientRequestsRoot: ['client-requests'] as const,
  clientRequests: (filters: ClientRequestFilters) =>
    ['client-requests', clientRequestFiltersQueryKey(filters)] as const,

  // ─── Notifications reçues (cloche de la barre supérieure) ─────────────────
  /** La racine invalide la cloche et ses pages ; `inbox` lit la cloche. */
  inboxRoot: ['inbox'] as const,
  inbox: ['inbox'] as const,
  inboxPage: (page: number, unreadOnly: boolean) => ['inbox', 'page', page, unreadOnly] as const,

  // ─── Mode démonstration ───────────────────────────────────────────────────
  demoStatus: ['demo-status'] as const,
  /** Clé du sondage du bandeau, imbriquée pour partager l'invalidation. */
  demoBanner: ['demo-status', 'banner'] as const,

  // ─── Administration ───────────────────────────────────────────────────────
  champsConversionRoot: ['champs-conversion'] as const,
  champsConversion: (projet: Projet) => ['champs-conversion', projet] as const,
  purgeCatalog: ['purge-catalog'] as const,
  supervision: ['supervision'] as const,

  /** Racine partagée : appliquer une simulation change la ligne du suivi ET de l'historique. */
  importsRoot: ['imports'] as const,
  importJobs: (page: number) => ['imports', 'page', page] as const,
  importJob: (id: string) => ['imports', 'detail', id] as const,

  /** L'envoi survit à la navigation : sa mutation et sa progression vivent dans le cache, pas dans la carte. */
  androidReleases: ['androidRelease', 'releases'] as const,
  androidReleaseUpload: ['androidRelease', 'upload'] as const,
  androidReleaseProgress: ['androidRelease', 'progress'] as const,
  /** Export intégral de la base : sondé pendant que `pg_dump` tourne. */
  databaseDump: ['database-dump'] as const,

  // ─── Statistiques ─────────────────────────────────────────────────────────
  statsRoot: ['stats'] as const,
  statsTeleconseil: (filters: ProspectFilters) =>
    ['stats', 'teleconseil', filtersQueryKey(filters)] as const,
  /** Des clés séparées évitent de coupler les volets lourds au rafraîchissement live. */
  statsCampagnes: (filters: ProspectFilters) =>
    ['stats', 'campagnes', filtersQueryKey(filters)] as const,
  statsDelais: (filters: ProspectFilters) => ['stats', 'delais', filtersQueryKey(filters)] as const,
  statsCohortes: (filters: ProspectFilters) =>
    ['stats', 'cohortes', filtersQueryKey(filters)] as const,
  statsRepresentants: (filters: ProspectFilters) =>
    ['stats', 'representants', filtersQueryKey(filters)] as const,
  statsQualite: (filters: ProspectFilters) =>
    ['stats', 'qualite', filtersQueryKey(filters)] as const,
  statsRendement: (filters: ProspectFilters) =>
    ['stats', 'rendement', filtersQueryKey(filters)] as const,
  statsProvenance: (filters: ProspectFilters) =>
    ['stats', 'provenance', filtersQueryKey(filters)] as const,
  statsVieillissement: (filters: ProspectFilters) =>
    ['stats', 'vieillissement', filtersQueryKey(filters)] as const,
  statsAmbassadeurs: (filters: ProspectFilters) =>
    ['stats', 'ambassadeurs', filtersQueryKey(filters)] as const,

  // ─── Plateformes d'enrôlement ─────────────────────────────────────────────
  enrolementRoot: ['enrolement'] as const,
  enrolementInscriptions: (projet: string, filtres: Record<string, unknown>) =>
    ['enrolement', 'inscriptions', projet, filtres] as const,
  enrolementIndicateurs: (projet: string, filtres: Record<string, unknown>) =>
    ['enrolement', 'indicateurs', projet, filtres] as const,
  enrolementReglages: (projet: string) => ['enrolement', 'reglages', projet] as const,
};
