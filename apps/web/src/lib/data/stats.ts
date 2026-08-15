import type { ApiClient } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { toFilterQuery } from '@/lib/api/query-params';
import { MAX_CHART_SERIES, groupTail } from '@/lib/data/series';
import type { DashboardStats, NamedCount, ProspectFilters, TimeSeriePoint } from '@/lib/types';

/**
 * Le regroupement de la queue est PARTAGÉ avec l'écran Statistiques
 * (`lib/data/series.ts`). Il en existait deux copies identiques ; réexporté ici
 * pour ne rien casser chez les appelants, défini une seule fois.
 */
export { MAX_CHART_SERIES, groupTail };

/**
 * `NamedCountDto` → `NamedCount`.
 *
 * `id` est nullable dans le contrat : l'API regroupe sous `null` les prospects
 * dont le référentiel a été supprimé. On retombe sur le libellé pour garder une
 * clé React stable : deux tranches « null » écraseraient sinon la même clé.
 */
function toNamedCounts(
  items: readonly { id?: string | null; label: string; prospects: number }[],
): NamedCount[] {
  return items.map((item) => ({
    id: item.id ?? `label:${item.label}`,
    label: item.label,
    value: item.prospects,
  }));
}

/**
 * Série temporelle cumulée.
 *
 * L'API renvoie un compte par période ; le cumul est calculé ici parce qu'il
 * dépend de la fenêtre affichée, pas de la donnée. Le faire côté serveur
 * obligerait à repasser les bornes une seconde fois.
 */
function toTimeSeries(buckets: readonly { bucket: string; prospects: number }[]): TimeSeriePoint[] {
  let cumulative = 0;
  return buckets.map((point) => {
    cumulative += point.prospects;
    return { date: point.bucket, count: point.prospects, cumulative };
  });
}

/**
 * Tableau de bord complet, en six appels parallèles.
 *
 * Le point important est la signature : les statistiques prennent LE MÊME
 * `ProspectFilters` que le tableau. Un tableau de bord alimenté par des
 * paramètres distincts finit toujours par afficher un total qui ne correspond
 * pas à la liste juste en dessous.
 */
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
