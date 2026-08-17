import {
  readEnum,
  readIsoDate,
  readPositiveInt,
  readString,
  type RawSearchParams,
} from '@/lib/search-params';
import type { CampaignStatus } from '@/lib/types';

export const REP_CAMPAIGN_PAGE_SIZE = 25;

const CAMPAIGN_STATUSES: readonly CampaignStatus[] = ['ACTIVE', 'CLOSED'];

export interface RepCampaignFilters {
  search: string;
  status: CampaignStatus | null;
  createdById: string | null;
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
