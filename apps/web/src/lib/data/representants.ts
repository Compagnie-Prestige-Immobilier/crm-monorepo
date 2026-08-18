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

export type RepresentantComment = components['schemas']['RepresentantCommentDto'];

export interface NewRepresentantComment {
  id: string;
  body: string;
  clientCreatedAt: string;
}

export const representantCommentsQueryKey = (representantId: string) =>
  ['representants', 'detail', representantId, 'comments'] as const;

export async function fetchRepresentantComments(
  representantId: string,
  client: ApiClient = getApiClient(),
): Promise<RepresentantComment[]> {
  const payload = unwrap(
    await client.GET('/api/v1/representants/{id}/comments', {
      params: { path: { id: representantId } },
    }),
  );
  return payload.items;
}

export async function createRepresentantComment(
  representantId: string,
  comment: NewRepresentantComment,
  client: ApiClient = getApiClient(),
): Promise<RepresentantComment> {
  return unwrap(
    await client.POST('/api/v1/representants/{id}/comments', {
      params: { path: { id: representantId } },
      body: comment,
    }),
  );
}

export async function deleteRepresentantComment(
  representantId: string,
  commentId: string,
  client: ApiClient = getApiClient(),
): Promise<void> {
  unwrap(
    await client.DELETE('/api/v1/representants/{id}/comments/{commentId}', {
      params: { path: { id: representantId, commentId } },
    }),
  );
}

/**
 * UUID v7 posé par le CLIENT : il sert de clé d'idempotence, un envoi rejoué
 * après une coupure ne doit pas doubler le commentaire.
 */
export function newCommentId(): string {
  const at = Date.now().toString(16).padStart(12, '0');
  const random = Array.from(crypto.getRandomValues(new Uint8Array(10)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
  const variant = ((Number.parseInt(random.slice(3, 4), 16) & 0x3) | 0x8).toString(16);
  return [
    at.slice(0, 8),
    at.slice(8, 12),
    `7${random.slice(0, 3)}`,
    `${variant}${random.slice(4, 7)}`,
    random.slice(7, 19),
  ].join('-');
}
