import type { ApiClient } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { flattenPage } from '@/lib/api/query-params';
import type { CreateUserInput, Paginated, Role, UpdateUserInput, UserRow } from '@/lib/types';

/**
 * Comptes commerciaux — `GET|POST /users`, `PATCH|DELETE /users/{id}`,
 * `PUT /users/{id}/active`, `PUT /users/{id}/password`.
 *
 * Réservé à l'ADMIN : l'API répond 403 à un COMMERCIAL, et l'écran coupe déjà
 * en amont (`getAdminSession`).
 */

export interface UserFilters {
  search: string;
  role: Role | null;
  /** `null` = tous les états ; c'est le défaut, un compte désactivé reste visible. */
  isActive: boolean | null;
  page: number;
  pageSize: number;
}

export const DEFAULT_USER_FILTERS: UserFilters = {
  search: '',
  role: 'COMMERCIAL',
  isActive: null,
  page: 1,
  pageSize: 25,
};

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

/**
 * Endpoint dédié plutôt que `PATCH /users/{id}` : côté API, désactiver révoque
 * aussi les refresh tokens du compte. Passer par le PATCH générique laisserait
 * la session mobile du commercial active jusqu'à expiration.
 */
export async function setUserActive(
  id: string,
  isActive: boolean,
  client: ApiClient = getApiClient(),
): Promise<UserRow> {
  return unwrap(
    await client.PUT('/api/v1/users/{id}/active', {
      params: { path: { id } },
      body: { isActive },
    }),
  );
}

/** Réinitialisation administrateur : 12 caractères minimum côté contrat. */
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

export async function deleteUser(id: string, client: ApiClient = getApiClient()): Promise<void> {
  unwrap(await client.DELETE('/api/v1/users/{id}', { params: { path: { id } } }));
}
