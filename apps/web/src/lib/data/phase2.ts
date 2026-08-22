import type { ApiClient, operations } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { flattenPage } from '@/lib/api/query-params';
import type { CampaignFilters } from '@/lib/campaign-filters';
import type {
  CampaignDetail,
  CampaignScope,
  CampaignSummary,
  CreateCampaignInput,
  Paginated,
  ProspectType,
} from '@/lib/types';

type CampaignQuery = NonNullable<operations['listCallCampaigns']['parameters']['query']>;

const startOfDay = (isoDate: string): string => `${isoDate}T00:00:00.000Z`;
const endOfDay = (isoDate: string): string => `${isoDate}T23:59:59.999Z`;

export function toCampaignQuery(
  filters: CampaignFilters,
  projet?: 'CHUES' | 'GRAND_PUBLIC',
): CampaignQuery {
  const query: CampaignQuery = {
    page: filters.page,
    pageSize: filters.pageSize,
    ...(projet ? { projet } : {}),
  };

  const search = filters.search.trim();
  if (search !== '') query.search = search;
  if (filters.status !== null) query.status = filters.status;
  if (filters.scope !== null) query.scope = filters.scope;
  if (filters.createdBy !== null) query.createdById = filters.createdBy;
  if (filters.dateFrom !== null) query.dateFrom = startOfDay(filters.dateFrom);
  if (filters.dateTo !== null) query.dateTo = endOfDay(filters.dateTo);

  return query;
}

export async function fetchCampaigns(
  filters: CampaignFilters,
  client: ApiClient = getApiClient(),
  projet?: 'CHUES' | 'GRAND_PUBLIC',
): Promise<Paginated<CampaignSummary>> {
  return flattenPage(
    unwrap(
      await client.GET('/api/v1/phase2/campaigns', {
        params: { query: toCampaignQuery(filters, projet) },
      }),
    ),
  );
}

export async function fetchCampaign(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<CampaignDetail> {
  return unwrap(await client.GET('/api/v1/phase2/campaigns/{id}', { params: { path: { id } } }));
}

export async function fetchCallRecording(
  attemptId: string,
  client: ApiClient = getApiClient(),
): Promise<Blob | null> {
  const result = await client.GET('/api/v1/phase2/call-attempts/{id}/recording', {
    params: { path: { id: attemptId } },
    parseAs: 'blob',
    cache: 'no-store',
  });
  if (result.response.status === 404) return null;
  if (result.error !== undefined) {
    throw new Error('La note vocale n’a pas pu être chargée.', { cause: result.error });
  }
  return result.data;
}

export async function createCampaign(
  input: CreateCampaignInput,
  client: ApiClient = getApiClient(),
): Promise<CampaignDetail> {
  return unwrap(await client.POST('/api/v1/phase2/campaigns', { body: input }));
}

export async function closeCampaign(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<CampaignDetail> {
  return unwrap(
    await client.POST('/api/v1/phase2/campaigns/{id}/close', { params: { path: { id } } }),
  );
}

export async function pauseCampaign(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<CampaignDetail> {
  return unwrap(
    await client.POST('/api/v1/phase2/campaigns/{id}/pause', { params: { path: { id } } }),
  );
}

export async function resumeCampaign(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<CampaignDetail> {
  return unwrap(
    await client.POST('/api/v1/phase2/campaigns/{id}/resume', { params: { path: { id } } }),
  );
}

export interface CampaignPreview {
  scope: CampaignScope;
  pending: number;
  alreadyAssigned: number;
  maximum: number;
  commercialCount: number;
  perCommercial: number[];
  spreadDays: number;
  perDay: number[];
}

export const MIN_SPREAD_DAYS = 1;
export const MAX_SPREAD_DAYS = 31;

export function spreadIntoDays(count: number, days: number): number[] {
  if (count <= 0) return [];
  const effective = Math.max(1, Math.min(days, count));
  const buckets = Array.from({ length: effective }, () => 0);
  for (let position = 1; position <= count; position += 1) {
    const index = Math.min(effective - 1, Math.floor(((position - 1) * effective) / count));
    buckets[index] = (buckets[index] ?? 0) + 1;
  }
  return buckets;
}

export function roundRobinSplit(total: number, buckets: number): number[] {
  if (buckets <= 0 || total <= 0) return [];
  const base = Math.floor(total / buckets);
  const remainder = total % buckets;
  return Array.from({ length: buckets }, (_, index) => base + (index < remainder ? 1 : 0));
}

export function buildCampaignPreview(input: {
  scope: CampaignScope;
  pending: number;
  alreadyAssigned: number;
  commercialCount: number;
  spreadDays?: number;
}): CampaignPreview {
  const maximum = Math.max(0, input.pending - input.alreadyAssigned);
  const spreadDays = input.spreadDays ?? MIN_SPREAD_DAYS;
  const perCommercial = roundRobinSplit(maximum, input.commercialCount);
  return {
    scope: input.scope,
    pending: input.pending,
    alreadyAssigned: input.alreadyAssigned,
    maximum,
    commercialCount: input.commercialCount,
    perCommercial,
    spreadDays,
    perDay: spreadIntoDays(perCommercial[0] ?? 0, spreadDays),
  };
}

export async function countPendingProspects(
  scope: CampaignScope,
  projet: 'CHUES' | 'GRAND_PUBLIC' = 'CHUES',
  client: ApiClient = getApiClient(),
): Promise<number> {
  const gpTypes: Partial<Record<CampaignScope, ProspectType>> = {
    GP1: 'FONCTIONNAIRE',
    GP2: 'SECTEUR_PRIVE',
    GP3: 'INFORMEL',
    GP4: 'DIASPORA',
  };
  const query = {
    projet,
    pageSize: 1,
    ...(projet === 'CHUES' ? { phase2Status: 'PENDING' as const } : {}),
    ...(scope.startsWith('BDD') ? { segment: scope as 'BDD1' | 'BDD2' | 'BDD3' | 'BDD4' } : {}),
    ...(gpTypes[scope] ? { type: gpTypes[scope] } : {}),
  };

  return unwrap(await client.GET('/api/v1/prospects', { params: { query } })).meta.total;
}

export async function countOpenTasks(client: ApiClient = getApiClient()): Promise<number> {
  const page = unwrap(
    await client.GET('/api/v1/phase2/campaigns', {
      params: { query: { status: 'ACTIVE', pageSize: 100 } },
    }),
  );
  return page.items.reduce((sum, campaign) => sum + campaign.progress.open, 0);
}

export async function fetchCampaignPreview(
  scope: CampaignScope,
  commercialCount: number,
  spreadDays: number,
  projet: 'CHUES' | 'GRAND_PUBLIC' = 'CHUES',
  client: ApiClient = getApiClient(),
): Promise<CampaignPreview> {
  const [pending, alreadyAssigned] = await Promise.all([
    countPendingProspects(scope, projet, client),
    countOpenTasks(client),
  ]);
  return buildCampaignPreview({ scope, pending, alreadyAssigned, commercialCount, spreadDays });
}

export function programmePdfUrl(campaignId: string, userId: string, day?: number): string {
  const base = `/api/v1/phase2/campaigns/${encodeURIComponent(campaignId)}/commerciaux/${encodeURIComponent(userId)}/programme.pdf`;
  return day === undefined ? base : `${base}?jour=${String(day)}`;
}

export function slugForFileName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/gu, '')
    .replace(/[^a-zA-Z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')
    .toLowerCase()
    .slice(0, 40);
}

export function programmePdfFileName(
  campaignName: string,
  commercialName: string,
  day?: number,
): string {
  const suffix = day === undefined ? '' : `-jour-${String(day)}`;
  return `programme-${slugForFileName(campaignName)}-${slugForFileName(commercialName)}${suffix}.pdf`;
}
