import type { ApiClient, operations } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';

type ProspectQuery = NonNullable<operations['listProspects']['parameters']['query']>;

export async function countPendingProspects(
  _scope: string,
  projet: 'CHUES' | 'GRAND_PUBLIC' = 'CHUES',
  client: ApiClient = getApiClient(),
): Promise<number> {
  const query: ProspectQuery = {
    projet,
    pageSize: 1,
    ...(projet === 'CHUES' ? { phase2Status: 'PENDING' } : {}),
  };
  return unwrap(await client.GET('/api/v1/prospects', { params: { query } })).meta.total;
}
