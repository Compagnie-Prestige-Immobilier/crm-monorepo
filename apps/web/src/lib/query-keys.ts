import { bankFiltersQueryKey, type BankCaseFilters } from '@/lib/bank-filters';
import { campaignFiltersQueryKey, type CampaignFilters } from '@/lib/campaign-filters';
import {
  clientRequestFiltersQueryKey,
  type ClientRequestFilters,
} from '@/lib/client-request-filters';
import { filtersQueryKey } from '@/lib/filters';
import { repCampaignFiltersQueryKey, type RepCampaignFilters } from '@/lib/rep-campaign-filters';
import { representantFiltersQueryKey, type RepresentantFilters } from '@/lib/representant-filters';
import { userFiltersQueryKey, type UserFilters } from '@/lib/user-filters';
import type { CampaignScope, ProspectFilters } from '@/lib/types';

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
  departements: ['referentiels', 'departements'] as const,
  regions: ['referentiels', 'regions'] as const,
  referentielUsage: ['referentiels', 'usage'] as const,

  // ─── Phase 2 ──────────────────────────────────────────────────────────────
  campaignsRoot: ['campaigns'] as const,
  campaigns: (filters: CampaignFilters) => ['campaigns', campaignFiltersQueryKey(filters)] as const,
  campaign: (id: string) => ['campaigns', 'detail', id] as const,
  /** Contient chaque entrée qui modifie le résultat de l'aperçu. */
  campaignPreview: (scope: CampaignScope, commercialCount: number, spreadDays: number) =>
    ['campaigns', 'preview', scope, commercialCount, spreadDays] as const,

  /** Racine distincte : les campagnes représentants sont une ressource API séparée. */
  repCampaignsRoot: ['rep-campaigns'] as const,
  repCampaigns: (filters: RepCampaignFilters) =>
    ['rep-campaigns', repCampaignFiltersQueryKey(filters)] as const,
  repCampaign: (id: string) => ['rep-campaigns', 'detail', id] as const,
  repCampaignPreview: (
    scope: { departementId: string | null; iefId: string | null; onlyWithoutProspects: boolean },
    commercialCount: number,
    spreadDays: number,
  ) =>
    [
      'rep-campaigns',
      'preview',
      scope.departementId,
      scope.iefId,
      scope.onlyWithoutProspects,
      commercialCount,
      spreadDays,
    ] as const,

  // ─── Banque & Finance ─────────────────────────────────────────────────────
  bankCasesRoot: ['bank-cases'] as const,
  bankCases: (filters: BankCaseFilters) => ['bank-cases', bankFiltersQueryKey(filters)] as const,
  bankCase: (id: string) => ['bank-cases', 'detail', id] as const,
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
  purgeCatalog: ['purge-catalog'] as const,
  supervision: ['supervision'] as const,

  /** Racine partagée : appliquer une simulation change la ligne du suivi ET de l'historique. */
  importsRoot: ['imports'] as const,
  importJobs: (page: number) => ['imports', 'page', page] as const,
  importJob: (id: string) => ['imports', 'detail', id] as const,

  androidUpdate: ['android-update'] as const,
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
};
