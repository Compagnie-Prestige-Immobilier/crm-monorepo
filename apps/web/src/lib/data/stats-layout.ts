import type { ApiClient } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';

export type StatsLayoutScreen = 'dashboard' | 'teleconseil';
export type StatsLayoutWidget = { id: string; visible: boolean };
export type StatsLayout = {
  screen: StatsLayoutScreen;
  widgets: StatsLayoutWidget[];
  updatedAt: string | null;
};

export async function fetchStatsLayout(
  screen: StatsLayoutScreen,
  client: ApiClient = getApiClient(),
): Promise<StatsLayout> {
  return unwrap(
    await client.GET(
      '/api/v1/analytics/layout' as never,
      {
        params: { query: { screen } },
      } as never,
    ),
  ) as StatsLayout;
}

export async function saveStatsLayout(
  screen: StatsLayoutScreen,
  widgets: readonly StatsLayoutWidget[],
  client: ApiClient = getApiClient(),
): Promise<StatsLayout> {
  return unwrap(
    await client.PUT(
      '/api/v1/analytics/layout' as never,
      {
        params: { query: { screen } },
        body: { widgets: [...widgets] },
      } as never,
    ),
  ) as StatsLayout;
}

export async function resetStatsLayout(
  screen: StatsLayoutScreen,
  client: ApiClient = getApiClient(),
): Promise<StatsLayout> {
  return unwrap(
    await client.DELETE(
      '/api/v1/analytics/layout' as never,
      {
        params: { query: { screen } },
      } as never,
    ),
  ) as StatsLayout;
}
