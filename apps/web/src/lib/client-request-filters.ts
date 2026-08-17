import type { components } from '@crm/api-client';

import { readPositiveInt, readString, type RawSearchParams } from '@/lib/search-params';

export type ClientRequestStatus = components['schemas']['ClientRequestStatus'];

export const CLIENT_REQUEST_STATUSES: readonly ClientRequestStatus[] = [
  'PENDING',
  'APPROVED',
  'REJECTED',
];

export const CLIENT_REQUEST_STATUS_LABELS: Record<ClientRequestStatus, string> = {
  PENDING: 'En attente',
  APPROVED: 'Approuvée',
  REJECTED: 'Refusée',
};

export const CLIENT_REQUEST_PAGE_SIZE = 25;

export interface ClientRequestFilters {
  status: ClientRequestStatus | null;
  search: string;
  banqueId: string | null;
  page: number;
  pageSize: number;
}

export const DEFAULT_CLIENT_REQUEST_FILTERS: ClientRequestFilters = {
  status: 'PENDING',
  search: '',
  banqueId: null,
  page: 1,
  pageSize: CLIENT_REQUEST_PAGE_SIZE,
};

export type { RawSearchParams };

export const ALL_STATUSES = 'tous';

export function parseClientRequestFilters(
  params: RawSearchParams | URLSearchParams,
): ClientRequestFilters {
  const status = readString(params, 'statut');

  return {
    status:
      status === ALL_STATUSES
        ? null
        : status !== null && (CLIENT_REQUEST_STATUSES as readonly string[]).includes(status)
          ? (status as ClientRequestStatus)
          : DEFAULT_CLIENT_REQUEST_FILTERS.status,
    search: readString(params, 'search') ?? '',
    banqueId: readString(params, 'banqueId'),
    page: readPositiveInt(params, 'page', 1),
    pageSize: CLIENT_REQUEST_PAGE_SIZE,
  };
}

export function serializeClientRequestFilters(filters: ClientRequestFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.status === null) params.set('statut', ALL_STATUSES);
  else if (filters.status !== DEFAULT_CLIENT_REQUEST_FILTERS.status) {
    params.set('statut', filters.status);
  }

  const search = filters.search.trim();
  if (search !== '') params.set('search', search);
  if (filters.banqueId !== null) params.set('banqueId', filters.banqueId);
  if (filters.page !== 1) params.set('page', String(filters.page));

  return params;
}

export function clientRequestFiltersQueryKey(filters: ClientRequestFilters): string {
  return serializeClientRequestFilters(filters).toString();
}

export function countActiveClientRequestFilters(filters: ClientRequestFilters): number {
  let count = 0;
  if (filters.status !== DEFAULT_CLIENT_REQUEST_FILTERS.status) count += 1;
  if (filters.search.trim() !== '') count += 1;
  if (filters.banqueId !== null) count += 1;
  return count;
}
