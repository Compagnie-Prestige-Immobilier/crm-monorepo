import type { ApiClient, components, operations } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { flattenPage } from '@/lib/api/query-params';
import { EMPTY_REPRESENTANT_FILTERS, type RepresentantFilters } from '@/lib/representant-filters';
import type { Paginated, RepresentantRow, UpdateRepresentantInput } from '@/lib/types';

type RepresentantQuery = NonNullable<operations['listRepresentants']['parameters']['query']>;

export type CreateRepresentantInput = components['schemas']['CreateRepresentantDto'];
export type RepresentantLookup = components['schemas']['RepresentantLookupDto'];
export type RepresentantRelationChange = components['schemas']['RepresentantRelationChangeDto'];

const startOfDay = (isoDate: string): string => `${isoDate}T00:00:00.000Z`;
const endOfDay = (isoDate: string): string => `${isoDate}T23:59:59.999Z`;

export function toRepresentantQuery(filters: RepresentantFilters): RepresentantQuery {
  const query: RepresentantQuery = {
    page: filters.page,
    pageSize: filters.pageSize,
  };

  const search = filters.search.trim();
  if (search !== '') query.search = search;
  if (filters.departementId !== null) query.departementId = filters.departementId;
  if (filters.iefId !== null) query.iefId = filters.iefId;
  if (filters.commercialId !== null) query.commercialId = filters.commercialId;
  if (filters.dateFrom !== null) query.dateFrom = startOfDay(filters.dateFrom);
  if (filters.dateTo !== null) query.dateTo = endOfDay(filters.dateTo);
  if (filters.hasProspects !== null) query.hasProspects = filters.hasProspects;
  if (filters.relationStatus !== null) query.relationStatus = filters.relationStatus;
  if (filters.sortBy !== EMPTY_REPRESENTANT_FILTERS.sortBy) query.sortBy = filters.sortBy;
  if (filters.sortDir !== EMPTY_REPRESENTANT_FILTERS.sortDir) {
    query.sortOrder = filters.sortDir;
  }

  return query;
}

export async function fetchRepresentants(
  filters: RepresentantFilters,
  client: ApiClient = getApiClient(),
): Promise<Paginated<RepresentantRow>> {
  return flattenPage(
    unwrap(
      await client.GET('/api/v1/representants', {
        params: { query: toRepresentantQuery(filters) },
      }),
    ),
  );
}

export async function fetchRepresentant(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<RepresentantRow> {
  return unwrap(await client.GET('/api/v1/representants/{id}', { params: { path: { id } } }));
}

export async function fetchRepresentantRelationHistory(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<RepresentantRelationChange[]> {
  const payload = unwrap(
    await client.GET('/api/v1/representants/{id}/relation-history', {
      params: { path: { id } },
    }),
  );
  return payload.items;
}

export async function createRepresentant(
  input: CreateRepresentantInput,
  client: ApiClient = getApiClient(),
): Promise<RepresentantRow> {
  return unwrap(await client.POST('/api/v1/representants', { body: input }));
}

export async function lookupRepresentantByPhone(
  phone: string,
  client: ApiClient = getApiClient(),
): Promise<RepresentantLookup> {
  return unwrap(await client.GET('/api/v1/representants/lookup', { params: { query: { phone } } }));
}

export async function updateRepresentant(
  id: string,
  patch: UpdateRepresentantInput,
  client: ApiClient = getApiClient(),
): Promise<RepresentantRow> {
  return unwrap(
    await client.PATCH('/api/v1/representants/{id}', { params: { path: { id } }, body: patch }),
  );
}

export async function deleteRepresentant(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<void> {
  unwrap(await client.DELETE('/api/v1/representants/{id}', { params: { path: { id } } }));
}
