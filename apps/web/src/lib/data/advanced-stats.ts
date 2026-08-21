import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { toFilterQuery } from '@/lib/api/query-params';
import type { NamedCount, ProspectFilters } from '@/lib/types';

type Schemas = components['schemas'];

export type CampaignPilotage = Schemas['CampaignPilotageDto'];
export type AnalyticsDelays = Schemas['AnalyticsDelaysDto'];
export type BankAging = Schemas['BankAgingDto'];
export type WeeklyCohortList = Schemas['WeeklyCohortListDto'];
export type RepresentantProductivityList = Schemas['RepresentantProductivityListDto'];
export type DataQuality = Schemas['DataQualityDto'];
export type DepartementYieldList = Schemas['DepartementYieldListDto'];
export type OriginBreakdown = Schemas['OriginBreakdownDto'];
export type AmbassadorConversion = Schemas['AmbassadorConversionDto'];

export async function fetchCampaignPilotage(
  filters: ProspectFilters,
  client: ApiClient = getApiClient(),
): Promise<CampaignPilotage> {
  return unwrap(
    await client.GET('/api/v1/analytics/campaign-pilotage', {
      params: { query: toFilterQuery(filters) },
    }),
  );
}

export async function fetchAnalyticsDelays(
  filters: ProspectFilters,
  client: ApiClient = getApiClient(),
): Promise<AnalyticsDelays> {
  return unwrap(
    await client.GET('/api/v1/analytics/delays', { params: { query: toFilterQuery(filters) } }),
  );
}

export async function fetchBankAging(
  filters: ProspectFilters,
  client: ApiClient = getApiClient(),
): Promise<BankAging> {
  return unwrap(
    await client.GET('/api/v1/analytics/bank-aging', { params: { query: toFilterQuery(filters) } }),
  );
}

export async function fetchWeeklyCohorts(
  filters: ProspectFilters,
  client: ApiClient = getApiClient(),
): Promise<WeeklyCohortList> {
  return unwrap(
    await client.GET('/api/v1/analytics/weekly-cohorts', {
      params: { query: toFilterQuery(filters) },
    }),
  );
}

export async function fetchRepresentantProductivity(
  filters: ProspectFilters,
  client: ApiClient = getApiClient(),
): Promise<RepresentantProductivityList> {
  return unwrap(
    await client.GET('/api/v1/analytics/representant-productivity', {
      params: { query: toFilterQuery(filters) },
    }),
  );
}

export async function fetchDataQuality(
  filters: ProspectFilters,
  client: ApiClient = getApiClient(),
): Promise<DataQuality> {
  return unwrap(
    await client.GET('/api/v1/analytics/data-quality', {
      params: { query: toFilterQuery(filters) },
    }),
  );
}

export async function fetchDepartementYield(
  filters: ProspectFilters,
  client: ApiClient = getApiClient(),
): Promise<DepartementYieldList> {
  return unwrap(
    await client.GET('/api/v1/analytics/departement-yield', {
      params: { query: toFilterQuery(filters) },
    }),
  );
}

export async function fetchOriginBreakdown(
  filters: ProspectFilters,
  client: ApiClient = getApiClient(),
): Promise<OriginBreakdown> {
  return unwrap(
    await client.GET('/api/v1/analytics/origin-breakdown', {
      params: { query: toFilterQuery(filters) },
    }),
  );
}

export async function fetchAmbassadorConversion(
  filters: ProspectFilters,
  client: ApiClient = getApiClient(),
): Promise<AmbassadorConversion> {
  return unwrap(
    await client.GET('/api/v1/analytics/ambassador-conversion', {
      params: { query: toFilterQuery(filters) },
    }),
  );
}

export function closedPerDayTotals(
  rows: readonly { day: string; done: number }[],
): { day: string; done: number }[] {
  const byDay = new Map<string, number>();
  for (const row of rows) byDay.set(row.day, (byDay.get(row.day) ?? 0) + row.done);
  return [...byDay.entries()]
    .map(([day, done]) => ({ day, done }))
    .sort((a, b) => a.day.localeCompare(b.day));
}

export function closedPerCommercial(
  rows: readonly { commercialId: string; commercialName: string; done: number }[],
): NamedCount[] {
  const byCommercial = new Map<string, { label: string; value: number }>();
  for (const row of rows) {
    const current = byCommercial.get(row.commercialId);
    byCommercial.set(row.commercialId, {
      label: row.commercialName,
      value: (current?.value ?? 0) + row.done,
    });
  }
  return [...byCommercial.entries()]
    .map(([id, entry]) => ({ id, label: entry.label, value: entry.value }))
    .sort((a, b) => b.value - a.value);
}

export function formatDelayDays(days: number | null): string {
  if (days === null) return 'Aucune mesure';
  if (days < 1) return 'Moins d’un jour';
  return `${String(Math.round(days * 10) / 10)} j`;
}

export function estimatedEndLabel(estimatedEndDate: string | null, remaining: number): string {
  if (remaining <= 0) return 'Tout est traité';
  if (estimatedEndDate === null) return 'Aucune cadence observée';
  return estimatedEndDate;
}
