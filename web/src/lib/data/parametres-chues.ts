import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';

type Schemas = components['schemas'];
export type ParametresChues = Schemas['ProspectParametresChues'];
export type UpdateParametresChues = Schemas['ProspectMajParametresInputBody'];
export type ParametreChangement = Schemas['ProspectParametreChangement'];

export async function fetchParametresChues(
  client: ApiClient = getApiClient(),
): Promise<ParametresChues> {
  return unwrap(await client.GET('/api/v1/parametres-chues'));
}

export async function updateParametresChues(
  body: UpdateParametresChues,
  client: ApiClient = getApiClient(),
): Promise<ParametresChues> {
  return unwrap(await client.PATCH('/api/v1/parametres-chues', { body }));
}

export async function fetchJournalParametres(
  client: ApiClient = getApiClient(),
): Promise<ParametreChangement[]> {
  const page = unwrap(await client.GET('/api/v1/parametres-chues/journal'));
  return page.items;
}
