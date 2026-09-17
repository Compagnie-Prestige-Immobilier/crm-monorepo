import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';

type Schemas = components['schemas'];

export type PlateformeEquipe = Schemas['PlateformeEquipeOutputBody'];
export type PlateformeCcp = Schemas['PlateformeCCP'];

export const plateformeEquipeKey = ['plateforme', 'equipe'] as const;

export async function fetchPlateformeEquipe(
  client: ApiClient = getApiClient(),
): Promise<PlateformeEquipe> {
  return unwrap(await client.GET('/api/v1/plateforme/equipe'));
}

export async function updatePlateformeObjectif(
  objectifAppelsParJour: number,
  client: ApiClient = getApiClient(),
): Promise<PlateformeEquipe> {
  return unwrap(
    await client.PUT('/api/v1/plateforme/objectif', { body: { objectifAppelsParJour } }),
  );
}
