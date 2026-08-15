import {
  readEnum,
  readIsoDate,
  readPositiveInt,
  readString,
  type RawSearchParams,
} from '@/lib/search-params';
import type { CampaignStatus } from '@/lib/types';

/**
 * Filtre des campagnes REPRÉSENTANTS, calqué sur `lib/campaign-filters.ts`.
 *
 * Deux modules séparés et non un module paramétré : côté API, les campagnes
 * représentants sont un module distinct (tables propres, garde-fous propres) et
 * leur liste ne connaît PAS le périmètre `scope` des campagnes prospects. Un
 * type commun obligerait chaque écran à ignorer la moitié des critères, et un
 * critère ignoré mais sérialisé finit par partir dans l'URL puis par produire
 * un 400.
 *
 * Les deux onglets sont deux ROUTES (`/campagnes` et
 * `/campagnes/representants`), et non un paramètre d'onglet : chaque liste
 * garde ainsi sa propre chaîne de requête. Partager l'URL obligerait à
 * préfixer toutes les clés, faute de quoi « Tout effacer » d'un côté
 * emporterait les critères de l'autre, sans que rien à l'écran ne l'explique.
 */

export const REP_CAMPAIGN_PAGE_SIZE = 25;

const CAMPAIGN_STATUSES: readonly CampaignStatus[] = ['ACTIVE', 'CLOSED'];

export interface RepCampaignFilters {
  search: string;
  status: CampaignStatus | null;
  /** Identifiant de l'administrateur qui a lancé le tirage (`createdById`). */
  createdById: string | null;
  /** Bornes incluses, `YYYY-MM-DD`, sur la date de création. */
  dateFrom: string | null;
  dateTo: string | null;
  page: number;
  pageSize: number;
}

export const EMPTY_REP_CAMPAIGN_FILTERS: RepCampaignFilters = {
  search: '',
  status: null,
  createdById: null,
  dateFrom: null,
  dateTo: null,
  page: 1,
  pageSize: REP_CAMPAIGN_PAGE_SIZE,
};

export type { RawSearchParams };

/** Noms de clés, alignés sur ceux des campagnes prospects : même écran, même vocabulaire. */
const KEY = {
  search: 'search',
  status: 'status',
  createdById: 'createdBy',
  dateFrom: 'dateFrom',
  dateTo: 'dateTo',
  page: 'page',
} as const;

export function parseRepCampaignFilters(
  params: RawSearchParams | URLSearchParams,
): RepCampaignFilters {
  return {
    search: readString(params, KEY.search) ?? '',
    status: readEnum<CampaignStatus>(params, KEY.status, CAMPAIGN_STATUSES),
    createdById: readString(params, KEY.createdById),
    dateFrom: readIsoDate(params, KEY.dateFrom),
    dateTo: readIsoDate(params, KEY.dateTo),
    page: readPositiveInt(params, KEY.page, 1),
    pageSize: REP_CAMPAIGN_PAGE_SIZE,
  };
}

/** Sérialisation canonique : défauts omis, ordre de clés fixe, donc clé de cache. */
export function serializeRepCampaignFilters(filters: RepCampaignFilters): URLSearchParams {
  const params = new URLSearchParams();
  const put = (key: string, value: string | null): void => {
    if (value !== null && value !== '') params.set(key, value);
  };

  put(KEY.search, filters.search.trim());
  put(KEY.status, filters.status);
  put(KEY.createdById, filters.createdById);
  put(KEY.dateFrom, filters.dateFrom);
  put(KEY.dateTo, filters.dateTo);
  if (filters.page !== 1) put(KEY.page, String(filters.page));

  return params;
}

export function repCampaignFiltersQueryKey(filters: RepCampaignFilters): string {
  return serializeRepCampaignFilters(filters).toString();
}

// ─── Filtrage simple / filtrage avancé ───────────────────────────────────────

/** Restent visibles la recherche et le statut, comme sur les campagnes prospects. */
export const REP_CAMPAIGN_ADVANCED_FILTER_KEYS = ['createdById', 'dateFrom', 'dateTo'] as const;

export type RepCampaignAdvancedFilterKey = (typeof REP_CAMPAIGN_ADVANCED_FILTER_KEYS)[number];

export function clearRepCampaignAdvancedFilters(): Partial<RepCampaignFilters> {
  return {
    createdById: null,
    dateFrom: null,
    dateTo: null,
  } satisfies Record<RepCampaignAdvancedFilterKey, null>;
}

export function countActiveRepCampaignFilters(filters: RepCampaignFilters): number {
  let count = 0;
  if (filters.search.trim() !== '') count += 1;
  if (filters.status !== null) count += 1;
  if (filters.createdById !== null) count += 1;
  if (filters.dateFrom !== null || filters.dateTo !== null) count += 1;
  return count;
}
