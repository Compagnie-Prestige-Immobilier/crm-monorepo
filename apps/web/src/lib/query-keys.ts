import { bankFiltersQueryKey, type BankCaseFilters } from '@/lib/bank-filters';
import type { CampaignFilters } from '@/lib/data/phase2';
import type { RepresentantFilters } from '@/lib/data/representants';
import type { UserFilters } from '@/lib/data/users';
import { filtersQueryKey } from '@/lib/filters';
import type { CampaignScope, ProspectFilters } from '@/lib/types';

/**
 * Toutes les clés de cache en un seul endroit.
 *
 * Le tableau et les graphiques dérivent la leur du MÊME objet de filtre :
 * invalider `prospects` invalide les deux, et il n'existe pas d'état où le
 * graphique montre une période et le tableau une autre.
 *
 * Les clés de liste sont préfixées (`['prospects', …]`) pour qu'une mutation
 * puisse invalider TOUTES les pages et tous les filtres d'une entité d'un seul
 * appel : `invalidateQueries({ queryKey: queryKeys.prospectsRoot })`. Invalider
 * la seule combinaison de filtres affichée laisserait les autres pages en cache
 * avec la donnée d'avant.
 */
export const queryKeys = {
  session: ['session'] as const,
  reference: ['reference'] as const,

  prospectsRoot: ['prospects'] as const,
  prospects: (filters: ProspectFilters) => ['prospects', filtersQueryKey(filters)] as const,
  prospect: (id: string) => ['prospects', 'detail', id] as const,

  dashboardRoot: ['dashboard'] as const,
  dashboard: (filters: ProspectFilters) => ['dashboard', filtersQueryKey(filters)] as const,

  /**
   * L'entonnoir et les montants. Clé DÉRIVÉE du même objet de filtre que le
   * reste du tableau de bord : le total encaissé décrit forcément la population
   * des compteurs affichés au-dessus de lui.
   */
  funnelRoot: ['funnel'] as const,
  funnel: (filters: ProspectFilters) => ['funnel', filtersQueryKey(filters)] as const,

  representantsRoot: ['representants'] as const,
  representants: (filters: RepresentantFilters) => ['representants', filters] as const,
  representant: (id: string) => ['representants', 'detail', id] as const,

  commerciauxRoot: ['commerciaux'] as const,
  commerciaux: (filters: UserFilters) => ['commerciaux', filters] as const,

  referentielsRoot: ['referentiels'] as const,
  banques: ['referentiels', 'banques'] as const,
  syndicats: ['referentiels', 'syndicats'] as const,
  departements: ['referentiels', 'departements'] as const,
  regions: ['referentiels', 'regions'] as const,
  referentielUsage: ['referentiels', 'usage'] as const,

  // ─── Phase 2 ──────────────────────────────────────────────────────────────
  campaignsRoot: ['campaigns'] as const,
  campaigns: (filters: CampaignFilters) => ['campaigns', filters] as const,
  campaign: (id: string) => ['campaigns', 'detail', id] as const,
  /**
   * L'aperçu dépend du périmètre ET du nombre de destinataires : deux clés
   * distinctes, sinon changer de segment afficherait l'ancien décompte le temps
   * d'un aller-retour — exactement le chiffre sur lequel l'administrateur va
   * fonder sa décision.
   */
  campaignPreview: (scope: CampaignScope, commercialCount: number) =>
    ['campaigns', 'preview', scope, commercialCount] as const,

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

  // ─── Mode démonstration ───────────────────────────────────────────────────
  demoStatus: ['demo-status'] as const,

  // ─── Administration ───────────────────────────────────────────────────────
  purgeCatalog: ['purge-catalog'] as const,
  supervision: ['supervision'] as const,
  androidUpdate: ['android-update'] as const,

  // ─── Statistiques ─────────────────────────────────────────────────────────
  statsRoot: ['stats'] as const,
  statsTeleconseil: (filters: ProspectFilters) =>
    ['stats', 'teleconseil', filtersQueryKey(filters)] as const,
};
