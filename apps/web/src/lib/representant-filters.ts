import {
  readEnum,
  readFrenchBoolean,
  readIsoDate,
  readPositiveInt,
  readString,
  type RawSearchParams,
} from '@/lib/search-params';
import type { SortDirection } from '@/lib/types';

/**
 * Filtre des représentants : traduction URL ⇄ objet, sur le modèle de
 * `lib/filters.ts` (prospects) et `lib/bank-filters.ts` (dossiers).
 *
 * L'écran gardait ses critères dans un `useState` : la vue filtrée n'était ni
 * partageable, ni restaurée au rechargement. « Les représentants de Ziguinchor
 * qui n'ont apporté aucun prospect » est maintenant une URL, comme partout
 * ailleurs dans le panel.
 *
 * Analyse TOLÉRANTE : une valeur inconnue est écartée, jamais propagée vers
 * l'API. Une URL bricolée à la main ne doit pas produire un 400 côté serveur
 * sur un écran que l'utilisateur n'a fait qu'ouvrir depuis un lien.
 */

export const REPRESENTANT_PAGE_SIZE = 25;

/**
 * Champs de tri proposés.
 *
 * Les trois seules questions qu'on se pose sur cette liste : qui a été saisi en
 * dernier, qui apporte le plus de prospects, et où se trouve tel nom. Le tri
 * n'est PAS un critère de filtre : il ne restreint aucune population, il ne
 * compte donc pas dans les puces du panneau avancé.
 */
/**
 * Les valeurs sont celles de `RepresentantSortField` côté API, au caractère
 * près : le tri part dans la chaîne de requête, et un libellé maison
 * (`prospectCount` au lieu de `prospects`) produirait un 400 sur un écran que
 * l'utilisateur n'a fait qu'ouvrir depuis un lien.
 */
export const REPRESENTANT_SORT_FIELDS = ['clientCreatedAt', 'fullName', 'prospects'] as const;

export type RepresentantSortField = (typeof REPRESENTANT_SORT_FIELDS)[number];

export const REPRESENTANT_SORT_LABELS: Record<RepresentantSortField, string> = {
  clientCreatedAt: 'Première saisie',
  fullName: 'Nom',
  prospects: 'Nombre de prospects',
};

export interface RepresentantFilters {
  search: string;
  departementId: string | null;
  iefId: string | null;
  commercialId: string | null;
  /** Bornes incluses, `YYYY-MM-DD`, sur la première saisie de la fiche. */
  dateFrom: string | null;
  dateTo: string | null;
  /** `true` : au moins un prospect. `false` : aucun. `null` : indifférent. */
  hasProspects: boolean | null;
  sortBy: RepresentantSortField;
  sortDir: SortDirection;
  page: number;
  pageSize: number;
}

export const EMPTY_REPRESENTANT_FILTERS: RepresentantFilters = {
  search: '',
  departementId: null,
  iefId: null,
  commercialId: null,
  dateFrom: null,
  dateTo: null,
  hasProspects: null,
  sortBy: 'clientCreatedAt',
  sortDir: 'desc',
  page: 1,
  pageSize: REPRESENTANT_PAGE_SIZE,
};

export type { RawSearchParams };

export function parseRepresentantFilters(
  params: RawSearchParams | URLSearchParams,
): RepresentantFilters {
  return {
    search: readString(params, 'search') ?? '',
    departementId: readString(params, 'departementId'),
    iefId: readString(params, 'iefId'),
    commercialId: readString(params, 'commercialId'),
    dateFrom: readIsoDate(params, 'dateFrom'),
    dateTo: readIsoDate(params, 'dateTo'),
    hasProspects: readFrenchBoolean(params, 'hasProspects'),
    sortBy:
      readEnum<RepresentantSortField>(params, 'sortBy', REPRESENTANT_SORT_FIELDS) ??
      EMPTY_REPRESENTANT_FILTERS.sortBy,
    sortDir: readString(params, 'sortDir') === 'asc' ? 'asc' : 'desc',
    page: readPositiveInt(params, 'page', 1),
    pageSize: REPRESENTANT_PAGE_SIZE,
  };
}

/** Sérialisation canonique : défauts omis, ordre de clés fixe, donc clé de cache. */
export function serializeRepresentantFilters(filters: RepresentantFilters): URLSearchParams {
  const params = new URLSearchParams();
  const put = (key: string, value: string | null): void => {
    if (value !== null && value !== '') params.set(key, value);
  };

  put('search', filters.search.trim());
  put('departementId', filters.departementId);
  put('iefId', filters.iefId);
  put('commercialId', filters.commercialId);
  put('dateFrom', filters.dateFrom);
  put('dateTo', filters.dateTo);
  if (filters.hasProspects !== null) put('hasProspects', filters.hasProspects ? 'oui' : 'non');
  if (filters.sortBy !== EMPTY_REPRESENTANT_FILTERS.sortBy) put('sortBy', filters.sortBy);
  if (filters.sortDir !== EMPTY_REPRESENTANT_FILTERS.sortDir) {
    put('sortDir', filters.sortDir);
  }
  if (filters.page !== 1) put('page', String(filters.page));

  return params;
}

export function representantFiltersQueryKey(filters: RepresentantFilters): string {
  return serializeRepresentantFilters(filters).toString();
}

// ─── Filtrage simple / filtrage avancé ───────────────────────────────────────

/**
 * Les critères rangés derrière « Filtres avancés ».
 *
 * Restent visibles la recherche, le département, l'IEF et le téléconseiller :
 * ce sont ceux qu'on touche à chaque session. La période de première saisie et
 * la présence de prospects répondent à une question ponctuelle (« qui dort
 * depuis janvier ? »), et le tri les accompagne sans être compté.
 */
export const REPRESENTANT_ADVANCED_FILTER_KEYS = ['dateFrom', 'dateTo', 'hasProspects'] as const;

export type RepresentantAdvancedFilterKey = (typeof REPRESENTANT_ADVANCED_FILTER_KEYS)[number];

export function clearRepresentantAdvancedFilters(): Partial<RepresentantFilters> {
  return {
    dateFrom: null,
    dateTo: null,
    hasProspects: null,
  } satisfies Record<RepresentantAdvancedFilterKey, null>;
}

/** Ce qui compte comme « filtre actif » pour l'affichage du bouton de remise à zéro. */
export function countActiveRepresentantFilters(filters: RepresentantFilters): number {
  let count = 0;
  if (filters.search.trim() !== '') count += 1;
  if (filters.departementId !== null) count += 1;
  if (filters.iefId !== null) count += 1;
  if (filters.commercialId !== null) count += 1;
  if (filters.dateFrom !== null || filters.dateTo !== null) count += 1;
  if (filters.hasProspects !== null) count += 1;
  return count;
}
