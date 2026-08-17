import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { toFilterQuery } from '@/lib/api/query-params';
import type { ProspectFilters } from '@/lib/types';

type Schemas = components['schemas'];

export type FunnelStage = Schemas['FunnelStageDto'];
export type FunnelFinance = Schemas['AnalyticsFinanceDto'];
export type Funnel = Schemas['AnalyticsFunnelDto'];

export async function fetchFunnel(
  filters: ProspectFilters,
  client: ApiClient = getApiClient(),
): Promise<Funnel> {
  return unwrap(
    await client.GET('/api/v1/analytics/funnel', { params: { query: toFilterQuery(filters) } }),
  );
}

export function breakingStageIndex(stages: readonly FunnelStage[]): number | null {
  if (stages.length < 2) return null;
  if ((stages[0]?.count ?? 0) === 0) return null;

  let index = -1;
  let lowest = Number.POSITIVE_INFINITY;
  let tied = false;

  for (let i = 1; i < stages.length; i += 1) {
    const rate = stages[i]?.tauxEtapePrecedente;
    if (rate === null || rate === undefined) continue;
    if (rate < lowest) {
      lowest = rate;
      index = i;
      tied = false;
    } else if (rate === lowest) {
      tied = true;
    }
  }

  if (index === -1 || tied || lowest >= 100) return null;
  return index;
}
