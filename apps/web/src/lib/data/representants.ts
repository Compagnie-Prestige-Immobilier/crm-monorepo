import type { ApiClient } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { flattenPage } from '@/lib/api/query-params';
import type { Paginated, RepresentantRow, UpdateRepresentantInput } from '@/lib/types';

/**
 * Représentants — les personnes rencontrées sur le terrain, qui apportent les
 * prospects. `GET|POST /representants`, `GET|PATCH|DELETE /representants/{id}`.
 */

export interface RepresentantFilters {
  search: string;
  departementId: string | null;
  commercialId: string | null;
  page: number;
  pageSize: number;
}

export const DEFAULT_REPRESENTANT_FILTERS: RepresentantFilters = {
  search: '',
  departementId: null,
  commercialId: null,
  page: 1,
  pageSize: 25,
};

export async function fetchRepresentants(
  filters: RepresentantFilters,
  client: ApiClient = getApiClient(),
): Promise<Paginated<RepresentantRow>> {
  const query: {
    search?: string;
    departementId?: string;
    commercialId?: string;
    page?: number;
    pageSize?: number;
  } = { page: filters.page, pageSize: filters.pageSize };

  const search = filters.search.trim();
  if (search !== '') query.search = search;
  if (filters.departementId !== null) query.departementId = filters.departementId;
  if (filters.commercialId !== null) query.commercialId = filters.commercialId;

  return flattenPage(unwrap(await client.GET('/api/v1/representants', { params: { query } })));
}

export async function fetchRepresentant(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<RepresentantRow> {
  return unwrap(await client.GET('/api/v1/representants/{id}', { params: { path: { id } } }));
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

/**
 * Suppression logique. L'API répond 409 tant que des prospects sont rattachés :
 * l'écran doit donc proposer de les réaffecter d'abord, pas se contenter
 * d'afficher « échec ».
 */
export async function deleteRepresentant(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<void> {
  unwrap(await client.DELETE('/api/v1/representants/{id}', { params: { path: { id } } }));
}
