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
  /**
   * L'aperçu dépend du périmètre ET du nombre de destinataires : deux clés
   * distinctes, sinon changer de segment afficherait l'ancien décompte le temps
   * d'un aller-retour : exactement le chiffre sur lequel l'administrateur va
   * fonder sa décision.
   */
  campaignPreview: (scope: CampaignScope, commercialCount: number, spreadDays: number) =>
    ['campaigns', 'preview', scope, commercialCount, spreadDays] as const,

  /**
   * Campagnes REPRÉSENTANTS : module séparé côté API, cache séparé ici.
   * Partager la racine `campaigns` ferait qu'une création de campagne
   * prospects invaliderait la liste des représentants, et réciproquement : deux
   * listes qui se rechargent sans raison sur un écran à onglets.
   */
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
  /**
   * La boîte de réception PERSONNELLE, distincte des clés de composition
   * (`components/notifications/api.ts`) : deux publics, deux caches. Un admin
   * qui compose une annonce ne doit pas voir sa propre cloche se recharger, et
   * marquer une ligne lue ne doit pas invalider l'historique d'envoi.
   */
  /**
   * `inboxRoot` sert à INVALIDER, `inbox` à LIRE le panneau de la cloche. Même
   * valeur aujourd'hui, deux intentions : marquer une notification lue doit
   * rafraîchir la cloche ET toutes les pages de l'écran complet, sans que
   * l'appelant ait à connaître leur découpage.
   */
  inboxRoot: ['inbox'] as const,
  inbox: ['inbox'] as const,
  /**
   * L'ÉCRAN complet de la boîte, paginé. Préfixé par `inbox` pour qu'un
   * marquage en lu invalide d'un seul appel la cloche et toutes les pages :
   * sinon la pastille retomberait à zéro pendant que la liste garderait ses
   * lignes en gras.
   */
  inboxPage: (page: number, unreadOnly: boolean) => ['inbox', 'page', page, unreadOnly] as const,

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
  /**
   * Les volets ajoutés (pilotage de campagne, délais, cohortes, qualité de
   * base, rendement) portent leur PROPRE clé alors qu'ils partagent le même
   * objet de filtre. C'est voulu : le volet téléconseil se rafraîchit en
   * continu (`useLive`), et faire dépendre huit requêtes analytiques lourdes du
   * même cycle multiplierait la charge SQL par huit pour des chiffres qui ne
   * bougent pas à la minute.
   */
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
};
