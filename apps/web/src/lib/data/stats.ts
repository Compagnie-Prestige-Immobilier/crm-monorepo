import type { ApiClient } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { toFilterQuery } from '@/lib/api/query-params';
import { MAX_CHART_SERIES, groupTail } from '@/lib/data/series';
import type { DashboardStats, NamedCount, ProspectFilters, TimeSeriePoint } from '@/lib/types';

export { MAX_CHART_SERIES, groupTail };

function toNamedCounts(
  items: readonly { id?: string | null; label: string; prospects: number }[],
): NamedCount[] {
  return items.map((item) => ({
    id: item.id ?? `label:${item.label}`,
    label: item.label,
    value: item.prospects,
  }));
}

function toTimeSeries(buckets: readonly { bucket: string; prospects: number }[]): TimeSeriePoint[] {
  let cumulative = 0;
  return buckets.map((point) => {
    cumulative += point.prospects;
    return { date: point.bucket, count: point.prospects, cumulative };
  });
}

export async function fetchDashboardStats(
  filters: ProspectFilters,
  client: ApiClient = getApiClient(),
): Promise<DashboardStats> {
  const query = toFilterQuery(filters);

  const [totals, overTime, commercials, departements, banques, syndicats, representants] =
    await Promise.all([
      client.GET('/api/v1/analytics/totals', { params: { query } }),
      client.GET('/api/v1/analytics/prospects-over-time', {
        params: { query: { ...query, granularity: 'day' } },
      }),
      client.GET('/api/v1/analytics/top-commercials', { params: { query } }),
      client.GET('/api/v1/analytics/by-departement', { params: { query } }),
      client.GET('/api/v1/analytics/by-banque', { params: { query } }),
      client.GET('/api/v1/analytics/by-syndicat', { params: { query } }),
      client.GET('/api/v1/analytics/top-representants', { params: { query } }),
    ]);

  return {
    kpis: unwrap(totals),
    prospectsOverTime: toTimeSeries(unwrap(overTime).buckets),
    topCommerciaux: groupTail(toNamedCounts(unwrap(commercials).items)),
    parDepartement: groupTail(toNamedCounts(unwrap(departements).items)),
    parBanque: groupTail(toNamedCounts(unwrap(banques).items)),
    parSyndicat: groupTail(toNamedCounts(unwrap(syndicats).items)),
    topRepresentants: groupTail(toNamedCounts(unwrap(representants).items)),
  };
}
