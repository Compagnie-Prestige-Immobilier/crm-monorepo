import type { ApiClient } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { toFilterQuery } from '@/lib/api/query-params';
import { MAX_CHART_SERIES, groupTail } from '@/lib/data/series';
import type {
  BddSegment,
  EnrollmentMethod,
  NamedCount,
  Phase2Status,
  ProspectFilters,
} from '@/lib/types';

export interface StatusCount {
  status: Phase2Status;
  label: string;
  prospects: number;
  share: number;
}

export interface MethodCount {
  method: EnrollmentMethod;
  label: string;
  prospects: number;
  share: number;
}

export interface SegmentCount {
  segment: BddSegment;
  label: string;
  prospects: number;
  share: number;
  methodObtained: number;
}

export interface TeleconseilStats {
  totals: {
    prospects: number;
    representants: number;
    teleconseillersActifs: number;
    departementsCouverts: number;
    prospects7Jours: number;
    prospects30Jours: number;
    converti: number;
    contacte: number;
    nouveau: number;
    perdu: number;
  };
  overTime: { date: string; count: number; cumulative: number }[];
  topTeleconseillers: NamedCount[];
  topTeleconseillerConversion: NamedCount[];
  parStatutPhase2: StatusCount[];
  parMethode: MethodCount[];
  parSegment: SegmentCount[];
  methodTotal: number;
}

export function percentOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 1000) / 10;
}

export function conversionRate(totals: { converti: number; prospects: number }): number {
  return percentOf(totals.converti, totals.prospects);
}

export function methodRate(input: { methodTotal: number; prospects: number }): number {
  return percentOf(input.methodTotal, input.prospects);
}

export function dailyAverage(prospects30Jours: number): number {
  return Math.round((prospects30Jours / 30) * 10) / 10;
}

export function weeklyPace(input: { prospects7Jours: number; prospects30Jours: number }): number {
  const earlier = Math.max(0, input.prospects30Jours - input.prospects7Jours);
  const perWeekEarlier = (earlier / 23) * 7;
  if (perWeekEarlier <= 0) return 0;
  return Math.round(((input.prospects7Jours - perWeekEarlier) / perWeekEarlier) * 1000) / 10;
}

export function bestSegment(segments: readonly SegmentCount[]): SegmentCount | null {
  const populated = segments.filter((segment) => segment.prospects > 0);
  if (populated.length === 0) return null;
  return populated.reduce((best, segment) =>
    percentOf(segment.methodObtained, segment.prospects) >
    percentOf(best.methodObtained, best.prospects)
      ? segment
      : best,
  );
}

function toTimeSeries(
  buckets: readonly { bucket: string; prospects: number }[],
): { date: string; count: number; cumulative: number }[] {
  let cumulative = 0;
  return buckets.map((point) => {
    cumulative += point.prospects;
    return { date: point.bucket, count: point.prospects, cumulative };
  });
}

export function hoursToDays(hours: number | null): number | null {
  if (hours === null) return null;
  return Math.round((hours / 24) * 10) / 10;
}

export { MAX_CHART_SERIES as MAX_SERIES, groupTail };

export async function fetchTeleconseilStats(
  filters: ProspectFilters,
  client: ApiClient = getApiClient(),
): Promise<TeleconseilStats> {
  const query = toFilterQuery(filters);

  const [totals, overTime, top, phase2, methods, segments] = await Promise.all([
    client.GET('/api/v1/analytics/totals', { params: { query } }),
    client.GET('/api/v1/analytics/prospects-over-time', {
      params: { query: { ...query, granularity: 'day' } },
    }),
    client.GET('/api/v1/analytics/top-commercials', {
      params: { query: { ...query, limit: 100 } },
    }),
    client.GET('/api/v1/analytics/by-phase2-status', { params: { query } }),
    client.GET('/api/v1/analytics/by-enrollment-method', { params: { query } }),
    client.GET('/api/v1/analytics/by-segment', { params: { query } }),
  ]);

  const kpis = unwrap(totals);
  const methodList = unwrap(methods);

  return {
    totals: {
      prospects: kpis.prospects,
      representants: kpis.representants,
      teleconseillersActifs: kpis.commerciauxActifs,
      departementsCouverts: kpis.departementsCouverts,
      prospects7Jours: kpis.prospects7Jours,
      prospects30Jours: kpis.prospects30Jours,
      converti: kpis.converti,
      contacte: kpis.contacte,
      nouveau: kpis.nouveau,
      perdu: kpis.perdu,
    },
    overTime: toTimeSeries(unwrap(overTime).buckets),
    topTeleconseillers: groupTail(
      unwrap(top).items.map((item) => ({
        id: item.id,
        label: item.label,
        value: item.prospects,
      })),
    ),
    topTeleconseillerConversion: groupTail(
      [
        ...(unwrap(top).items as Array<{
          id: string;
          label: string;
          prospects: number;
          conversionRate?: number | null;
        }>),
      ]
        .map((item) => ({
          id: item.id,
          label: item.label,
          value: item.conversionRate ?? 0,
        }))
        .sort((left, right) => right.value - left.value || left.label.localeCompare(right.label)),
    ),
    parStatutPhase2: unwrap(phase2).items.map((item) => ({
      status: item.status,
      label: item.label,
      prospects: item.prospects,
      share: item.share,
    })),
    parMethode: methodList.items.map((item) => ({
      method: item.method,
      label: item.label,
      prospects: item.prospects,
      share: item.share,
    })),
    parSegment: unwrap(segments).items.map((item) => ({
      segment: item.segment,
      label: item.label,
      prospects: item.prospects,
      share: item.share,
      methodObtained: item.methodObtained,
    })),
    methodTotal: methodList.total,
  };
}
