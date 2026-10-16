import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';

export type PortefeuilleOrphelin = components['schemas']['PortefeuilleOrphelin'];

/** Comptes désactivés ou supprimés qui détiennent encore des fiches. */
export async function fetchPortefeuillesOrphelins(
  client: ApiClient = getApiClient(),
): Promise<PortefeuilleOrphelin[]> {
  return unwrap(await client.GET('/api/v1/portefeuilles-orphelins')).items;
}

/** Prospects et représentants du compte passent au téléconseiller choisi. */
export async function reprendrePortefeuille(
  id: string,
  handoverToId: string,
  client: ApiClient = getApiClient(),
): Promise<void> {
  unwrap(
    await client.POST('/api/v1/portefeuilles-orphelins/{id}/reprise', {
      params: { path: { id } },
      body: { handoverToId },
    }),
  );
}
