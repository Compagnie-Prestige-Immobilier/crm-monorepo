import type { ApiClient } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { flattenPage } from '@/lib/api/query-params';
import type { CreateUserInput, Paginated, Role, UpdateUserInput, UserRow } from '@/lib/types';
import type { UserFilters } from '@/lib/user-filters';

export async function fetchUsers(
  filters: UserFilters,
  client: ApiClient = getApiClient(),
): Promise<Paginated<UserRow>> {
  const query: {
    search?: string;
    role?: Role;
    isActive?: boolean;
    page?: number;
    pageSize?: number;
  } = { page: filters.page, pageSize: filters.pageSize };

  const search = filters.search.trim();
  if (search !== '') query.search = search;
  if (filters.role !== null) query.role = filters.role;
  if (filters.isActive !== null) query.isActive = filters.isActive;

  return flattenPage(unwrap(await client.GET('/api/v1/users', { params: { query } })));
}

export async function createUser(
  input: CreateUserInput,
  client: ApiClient = getApiClient(),
): Promise<UserRow> {
  return unwrap(await client.POST('/api/v1/users', { body: input }));
}

export async function updateUser(
  id: string,
  patch: UpdateUserInput,
  client: ApiClient = getApiClient(),
): Promise<UserRow> {
  return unwrap(
    await client.PATCH('/api/v1/users/{id}', { params: { path: { id } }, body: patch }),
  );
}

export async function setUserActive(
  id: string,
  isActive: boolean,
  handoverToId?: string,
  client: ApiClient = getApiClient(),
): Promise<UserRow> {
  return unwrap(
    await client.PUT('/api/v1/users/{id}/active', {
      params: { path: { id } },
      body: { isActive, ...(handoverToId === undefined ? {} : { handoverToId }) },
    }),
  );
}

export async function resetUserPassword(
  id: string,
  password: string,
  client: ApiClient = getApiClient(),
): Promise<void> {
  unwrap(
    await client.PUT('/api/v1/users/{id}/password', {
      params: { path: { id } },
      body: { password },
    }),
  );
}

export async function deleteUser(
  id: string,
  handoverToId?: string,
  client: ApiClient = getApiClient(),
): Promise<void> {
  unwrap(
    await client.DELETE('/api/v1/users/{id}', {
      params: {
        path: { id },
        query: handoverToId === undefined ? {} : { handoverToId },
      },
    }),
  );
}
