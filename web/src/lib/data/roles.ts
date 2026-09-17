import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import type { Role } from '@/lib/types';

export type RoleCompte = components['schemas']['RoleDto'];
export type PermissionCatalogue = components['schemas']['PermissionDto'];
export type Roles = components['schemas']['RolesDto'];

export async function fetchRoles(client: ApiClient = getApiClient()): Promise<Roles> {
  return unwrap(await client.GET('/api/v1/roles'));
}

export async function createRole(
  body: { libelle: string; roleDeBase: Role; permissions?: string[] },
  client: ApiClient = getApiClient(),
): Promise<RoleCompte> {
  return unwrap(await client.POST('/api/v1/roles', { body }));
}

export async function updateRole(
  id: string,
  body: { libelle?: string; roleDeBase?: Role },
  client: ApiClient = getApiClient(),
): Promise<RoleCompte> {
  return unwrap(await client.PATCH('/api/v1/roles/{id}', { params: { path: { id } }, body }));
}

export async function deleteRole(id: string, client: ApiClient = getApiClient()): Promise<void> {
  unwrap(await client.DELETE('/api/v1/roles/{id}', { params: { path: { id } } }));
}

export async function replacePermissions(
  id: string,
  permissions: string[],
  client: ApiClient = getApiClient(),
): Promise<RoleCompte> {
  return unwrap(
    await client.PUT('/api/v1/roles/{id}/permissions', {
      params: { path: { id } },
      body: { permissions },
    }),
  );
}
