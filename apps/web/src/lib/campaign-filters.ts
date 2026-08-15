import {
  readEnum,
  readIsoDate,
  readPositiveInt,
  readString,
  type RawSearchParams,
} from '@/lib/search-params';
import { CAMPAIGN_SCOPES, type CampaignScope, type CampaignStatus } from '@/lib/types';

/**
 * Filtre des campagnes d'appels : traduction URL ⇄ objet, sur le modèle de
 * `lib/filters.ts` (prospects) et `lib/bank-filters.ts` (dossiers).
 *
 * L'écran n'offrait que trois boutons de statut, dans un `useState` : au-delà
 * d'une dizaine de campagnes, retrouver « la campagne BDD2 de mars créée par
 * untel » se faisait à l'œil, page après page, sans possibilité de partager le
 * résultat.
 *
 * Analyse TOLÉRANTE : une valeur inconnue est écartée, jamais propagée vers
 * l'API. Une URL bricolée à la main ne doit pas produire un 400 sur un écran
 * que l'utilisateur n'a fait qu'ouvrir depuis un lien.
 */

export const CAMPAIGN_PAGE_SIZE = 25;

const CAMPAIGN_STATUSES: readonly CampaignStatus[] = ['ACTIVE', 'CLOSED'];

export interface CampaignFilters {
  search: string;
  status: CampaignStatus | null;
  scope: CampaignScope | null;
  /** Identifiant de l'administrateur qui a lancé le tirage (`createdById` côté API). */
  createdBy: string | null;
  /** Bornes incluses, `YYYY-MM-DD`, sur la date de création. */
  dateFrom: string | null;
  dateTo: string | null;
  page: number;
  pageSize: number;
}

export const EMPTY_CAMPAIGN_FILTERS: CampaignFilters = {
  search: '',
  status: null,
  scope: null,
  createdBy: null,
  dateFrom: null,
  dateTo: null,
  page: 1,
  pageSize: CAMPAIGN_PAGE_SIZE,
};

export type { RawSearchParams };

export function parseCampaignFilters(params: RawSearchParams | URLSearchParams): CampaignFilters {
  return {
    search: readString(params, 'search') ?? '',
    status: readEnum<CampaignStatus>(params, 'status', CAMPAIGN_STATUSES),
    scope: readEnum<CampaignScope>(params, 'scope', CAMPAIGN_SCOPES),
    createdBy: readString(params, 'createdBy'),
    dateFrom: readIsoDate(params, 'dateFrom'),
    dateTo: readIsoDate(params, 'dateTo'),
    page: readPositiveInt(params, 'page', 1),
    pageSize: CAMPAIGN_PAGE_SIZE,
  };
}

/** Sérialisation canonique : défauts omis, ordre de clés fixe, donc clé de cache. */
export function serializeCampaignFilters(filters: CampaignFilters): URLSearchParams {
  const params = new URLSearchParams();
  const put = (key: string, value: string | null): void => {
    if (value !== null && value !== '') params.set(key, value);
  };

  put('search', filters.search.trim());
  put('status', filters.status);
  put('scope', filters.scope);
  put('createdBy', filters.createdBy);
  put('dateFrom', filters.dateFrom);
  put('dateTo', filters.dateTo);
  if (filters.page !== 1) put('page', String(filters.page));

  return params;
}

export function campaignFiltersQueryKey(filters: CampaignFilters): string {
  return serializeCampaignFilters(filters).toString();
}

// ─── Filtrage simple / filtrage avancé ───────────────────────────────────────

/**
 * Les critères rangés derrière « Filtres avancés ».
 *
 * Restent visibles la recherche et le statut : ce sont les deux gestes de
 * chaque session (« où en sont les campagnes en cours ? »). Le périmètre, le
 * créateur et la période servent à retrouver une campagne précise, quelques
 * fois par mois.
 */
export const CAMPAIGN_ADVANCED_FILTER_KEYS = ['scope', 'createdBy', 'dateFrom', 'dateTo'] as const;

export type CampaignAdvancedFilterKey = (typeof CAMPAIGN_ADVANCED_FILTER_KEYS)[number];

export function clearCampaignAdvancedFilters(): Partial<CampaignFilters> {
  return {
    scope: null,
    createdBy: null,
    dateFrom: null,
    dateTo: null,
  } satisfies Record<CampaignAdvancedFilterKey, null>;
}

/** Ce qui compte comme « filtre actif » pour l'affichage du bouton de remise à zéro. */
export function countActiveCampaignFilters(filters: CampaignFilters): number {
  let count = 0;
  if (filters.search.trim() !== '') count += 1;
  if (filters.status !== null) count += 1;
  if (filters.scope !== null) count += 1;
  if (filters.createdBy !== null) count += 1;
  if (filters.dateFrom !== null || filters.dateTo !== null) count += 1;
  return count;
}
