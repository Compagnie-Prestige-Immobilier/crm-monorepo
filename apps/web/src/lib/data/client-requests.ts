import type { ApiClient, components, operations } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import type { ClientRequestFilters } from '@/lib/client-request-filters';

type Schemas = components['schemas'];

export type ClientRequest = Schemas['ClientRequestDto'];
export type ClientRequestList = Schemas['ClientRequestListDto'];
export type CreateClientRequestInput = Schemas['CreateClientRequestDto'];
export type ApproveClientRequestInput = Schemas['ApproveClientRequestDto'];

export async function fetchClientRequests(
  filters: ClientRequestFilters,
  client: ApiClient = getApiClient(),
): Promise<ClientRequestList> {
  const query: NonNullable<operations['listClientRequests']['parameters']['query']> = {
    page: filters.page,
    pageSize: filters.pageSize,
  };
  if (filters.status !== null) query.status = filters.status;
  const search = filters.search.trim();
  if (search !== '') query.search = search;
  if (filters.banqueId !== null) query.banqueId = filters.banqueId;

  return unwrap(await client.GET('/api/v1/client-requests', { params: { query } }));
}

export async function createClientRequest(
  input: CreateClientRequestInput,
  client: ApiClient = getApiClient(),
): Promise<ClientRequest> {
  return unwrap(await client.POST('/api/v1/client-requests', { body: input }));
}

export async function approveClientRequest(
  id: string,
  input: ApproveClientRequestInput,
  client: ApiClient = getApiClient(),
): Promise<ClientRequest> {
  return unwrap(
    await client.POST('/api/v1/client-requests/{id}/approve', {
      params: { path: { id } },
      body: input,
    }),
  );
}

export async function rejectClientRequest(
  id: string,
  reason: string,
  client: ApiClient = getApiClient(),
): Promise<ClientRequest> {
  return unwrap(
    await client.POST('/api/v1/client-requests/{id}/reject', {
      params: { path: { id } },
      body: { reason },
    }),
  );
}

export function originLabelFor(origin: string | null, originLabel: string | null): string {
  if (origin === null) return 'Tournée terrain';
  if (origin === 'BANQUE') {
    return originLabel === null ? 'Demande d’une banque' : `Demande de ${originLabel}`;
  }
  return originLabel ?? origin;
}
