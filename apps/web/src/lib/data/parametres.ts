import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';

export type ParametresChues = components['schemas']['ParametresChuesDto'];
export type ParametresPublics = components['schemas']['ParametresPublicsDto'];
export type UpdateParametresChues = components['schemas']['UpdateParametresChuesDto'];

export async function fetchParametresChues(
  client: ApiClient = getApiClient(),
): Promise<ParametresChues> {
  return unwrap(await client.GET('/api/v1/parametres/chues'));
}

/** Ce que le téléconseiller dicte au prospect selon la méthode retenue. */
export async function fetchParametresEnrolement(
  client: ApiClient = getApiClient(),
): Promise<ParametresPublics> {
  return unwrap(await client.GET('/api/v1/parametres/enrolement'));
}

export async function updateParametresChues(
  body: UpdateParametresChues,
  client: ApiClient = getApiClient(),
): Promise<ParametresChues> {
  return unwrap(await client.PUT('/api/v1/parametres/chues', { body }));
}
