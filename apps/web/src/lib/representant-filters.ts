import {
  readEnum,
  readFrenchBoolean,
  readIsoDate,
  readPositiveInt,
  readString,
  type RawSearchParams,
} from '@/lib/search-params';
import type { SortDirection } from '@/lib/types';

export const REPRESENTANT_PAGE_SIZE = 25;

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
  dateFrom: string | null;
  dateTo: string | null;
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

export const REPRESENTANT_ADVANCED_FILTER_KEYS = ['dateFrom', 'dateTo', 'hasProspects'] as const;

export type RepresentantAdvancedFilterKey = (typeof REPRESENTANT_ADVANCED_FILTER_KEYS)[number];

export function clearRepresentantAdvancedFilters(): Partial<RepresentantFilters> {
  return {
    dateFrom: null,
    dateTo: null,
    hasProspects: null,
  } satisfies Record<RepresentantAdvancedFilterKey, null>;
}

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
