import type { ApiClient } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';

/**
 * Les fiches qu'une campagne a confiées au lecteur. `tout` marque l'encadrement,
 * à qui rien n'est confié : la question ne se pose pas pour lui.
 */
export async function fetchMesAttributions(
  client: ApiClient = getApiClient(),
): Promise<{ prospectIds: string[]; tout: boolean }> {
  const body = unwrap(await client.GET('/api/v1/lots-export/mes-attributions'));
  return { prospectIds: body.prospectIds, tout: body.tout };
}
