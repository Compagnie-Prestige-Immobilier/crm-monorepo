import {
  readEnum,
  readIsoDate,
  readPositiveInt,
  readString,
  type RawSearchParams,
} from '@/lib/search-params';
import {
  BDD_SEGMENTS,
  ENROLLMENT_METHODS,
  PHASE2_STATUSES,
  PROSPECT_SORT_FIELDS,
  PROSPECT_STATUTS,
  type BddSegment,
  type EnrollmentMethod,
  type Phase2Status,
  type ProspectFilters,
  type ProspectSortField,
  type ProspectStatut,
  type SortDirection,
} from '@/lib/types';

export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export const EMPTY_FILTERS: ProspectFilters = {
  search: '',
  commercialId: null,
  representantId: null,
  departementId: null,
  banqueId: null,
  syndicatId: null,
  statut: null,
  segment: null,
  phase2Status: null,
  enrollmentMethod: null,
  campaignId: null,
  enrollmentCapturedById: null,
  dateFrom: null,
  dateTo: null,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  sortBy: 'clientCreatedAt',
  sortDir: 'desc',
};

export type { RawSearchParams };

function readStatut(params: RawSearchParams | URLSearchParams): ProspectStatut | null {
  return readEnum<ProspectStatut>(params, 'statut', PROSPECT_STATUTS);
}

function readSortBy(params: RawSearchParams | URLSearchParams): ProspectSortField {
  return (
    readEnum<ProspectSortField>(params, 'sortBy', PROSPECT_SORT_FIELDS) ?? EMPTY_FILTERS.sortBy
  );
}

function readSortDir(params: RawSearchParams | URLSearchParams): SortDirection {
  return readString(params, 'sortDir') === 'asc' ? 'asc' : 'desc';
}

export function parseProspectFilters(params: RawSearchParams | URLSearchParams): ProspectFilters {
  const pageSize = readPositiveInt(params, 'pageSize', DEFAULT_PAGE_SIZE);
  return {
    search: readString(params, 'search') ?? '',
    commercialId: readString(params, 'commercialId'),
    representantId: readString(params, 'representantId'),
    departementId: readString(params, 'departementId'),
    banqueId: readString(params, 'banqueId'),
    syndicatId: readString(params, 'syndicatId'),
    statut: readStatut(params),
    segment: readEnum<BddSegment>(params, 'segment', BDD_SEGMENTS),
    phase2Status: readEnum<Phase2Status>(params, 'phase2Status', PHASE2_STATUSES),
    enrollmentMethod: readEnum<EnrollmentMethod>(params, 'enrollmentMethod', ENROLLMENT_METHODS),
    campaignId: readString(params, 'campaignId'),
    enrollmentCapturedById: readString(params, 'enrollmentCapturedById'),
    dateFrom: readIsoDate(params, 'dateFrom'),
    dateTo: readIsoDate(params, 'dateTo'),
    page: readPositiveInt(params, 'page', 1),
    pageSize: (PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSize)
      ? pageSize
      : DEFAULT_PAGE_SIZE,
    sortBy: readSortBy(params),
    sortDir: readSortDir(params),
  };
}

export function serializeProspectFilters(filters: ProspectFilters): URLSearchParams {
  const params = new URLSearchParams();
  const put = (key: string, value: string | null): void => {
    if (value !== null && value !== '') params.set(key, value);
  };

  put('search', filters.search.trim());
  put('commercialId', filters.commercialId);
  put('representantId', filters.representantId);
  put('departementId', filters.departementId);
  put('banqueId', filters.banqueId);
  put('syndicatId', filters.syndicatId);
  put('statut', filters.statut);
  put('segment', filters.segment);
  put('phase2Status', filters.phase2Status);
  put('enrollmentMethod', filters.enrollmentMethod);
  put('campaignId', filters.campaignId);
  put('enrollmentCapturedById', filters.enrollmentCapturedById);
  put('dateFrom', filters.dateFrom);
  put('dateTo', filters.dateTo);
  if (filters.page !== 1) put('page', String(filters.page));
  if (filters.pageSize !== DEFAULT_PAGE_SIZE) put('pageSize', String(filters.pageSize));
  if (filters.sortBy !== EMPTY_FILTERS.sortBy) put('sortBy', filters.sortBy);
  if (filters.sortDir !== EMPTY_FILTERS.sortDir) put('sortDir', filters.sortDir);

  return params;
}

export function filtersQueryKey(filters: ProspectFilters): string {
  return serializeProspectFilters(filters).toString();
}

export const ADVANCED_FILTER_KEYS = [
  'representantId',
  'departementId',
  'banqueId',
  'syndicatId',
  'statut',
  'segment',
  'phase2Status',
  'enrollmentMethod',
  'campaignId',
  'enrollmentCapturedById',
] as const;

export type AdvancedFilterKey = (typeof ADVANCED_FILTER_KEYS)[number];

export function activeAdvancedKeys(filters: ProspectFilters): AdvancedFilterKey[] {
  return ADVANCED_FILTER_KEYS.filter((key) => filters[key] !== null);
}

export function countAdvancedFilters(filters: ProspectFilters): number {
  return activeAdvancedKeys(filters).length;
}

export function hasAdvancedFilters(filters: ProspectFilters): boolean {
  return ADVANCED_FILTER_KEYS.some((key) => filters[key] !== null);
}

export function clearAdvancedFilters(): Partial<ProspectFilters> {
  return {
    representantId: null,
    departementId: null,
    banqueId: null,
    syndicatId: null,
    statut: null,
    segment: null,
    phase2Status: null,
    enrollmentMethod: null,
    campaignId: null,
    enrollmentCapturedById: null,
  } satisfies Record<AdvancedFilterKey, null>;
}

export function initialAdvancedOpen(filters: ProspectFilters, stored: boolean | null): boolean {
  return advancedOpenFrom(hasAdvancedFilters(filters), stored);
}

export function advancedOpenFrom(hasAdvanced: boolean, stored: boolean | null): boolean {
  if (hasAdvanced) return true;
  return stored ?? false;
}

export function countActiveFilters(filters: ProspectFilters): number {
  let count = 0;
  if (filters.search.trim() !== '') count += 1;
  if (filters.commercialId !== null) count += 1;
  if (filters.representantId !== null) count += 1;
  if (filters.departementId !== null) count += 1;
  if (filters.banqueId !== null) count += 1;
  if (filters.syndicatId !== null) count += 1;
  if (filters.statut !== null) count += 1;
  if (filters.segment !== null) count += 1;
  if (filters.phase2Status !== null) count += 1;
  if (filters.enrollmentMethod !== null) count += 1;
  if (filters.campaignId !== null) count += 1;
  if (filters.enrollmentCapturedById !== null) count += 1;
  if (filters.dateFrom !== null || filters.dateTo !== null) count += 1;
  return count;
}
