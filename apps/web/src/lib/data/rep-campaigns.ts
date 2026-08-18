import type { ApiClient, components, operations } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { flattenPage } from '@/lib/api/query-params';
import { slugForFileName } from '@/lib/data/phase2';
import type { RepCampaignFilters } from '@/lib/rep-campaign-filters';
import type { Paginated } from '@/lib/types';

type Schemas = components['schemas'];

export type RepCampaignSummary = Schemas['RepCampaignSummaryDto'];
export type RepCampaignDetail = Schemas['RepCampaignDetailDto'];
export type RepCampaignCommercial = Schemas['RepCampaignCommercialDto'];
export type RepCampaignPreview = Schemas['RepCampaignPreviewDto'];
export type CreateRepCampaignInput = Schemas['CreateRepCampaignDto'];

type RepCampaignQuery = NonNullable<operations['listRepCampaigns']['parameters']['query']>;

const startOfDay = (isoDate: string): string => `${isoDate}T00:00:00.000Z`;
const endOfDay = (isoDate: string): string => `${isoDate}T23:59:59.999Z`;

export async function fetchRepCampaigns(
  filters: RepCampaignFilters,
  client: ApiClient = getApiClient(),
): Promise<Paginated<RepCampaignSummary>> {
  const query: RepCampaignQuery = {
    page: filters.page,
    pageSize: filters.pageSize,
  };

  const search = filters.search.trim();
  if (search !== '') query.search = search;
  if (filters.status !== null) query.status = filters.status;
  if (filters.createdById !== null) query.createdById = filters.createdById;
  if (filters.dateFrom !== null) query.dateFrom = startOfDay(filters.dateFrom);
  if (filters.dateTo !== null) query.dateTo = endOfDay(filters.dateTo);

  return flattenPage(unwrap(await client.GET('/api/v1/rep-campaigns', { params: { query } })));
}

export async function fetchRepCampaign(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<RepCampaignDetail> {
  return unwrap(await client.GET('/api/v1/rep-campaigns/{id}', { params: { path: { id } } }));
}

export async function createRepCampaign(
  input: CreateRepCampaignInput,
  client: ApiClient = getApiClient(),
): Promise<RepCampaignDetail> {
  return unwrap(await client.POST('/api/v1/rep-campaigns', { body: input }));
}

export async function closeRepCampaign(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<RepCampaignDetail> {
  return unwrap(
    await client.POST('/api/v1/rep-campaigns/{id}/close', { params: { path: { id } } }),
  );
}

export interface RepCampaignScope {
  departementId: string | null;
  iefId: string | null;
  onlyWithoutProspects: boolean;
}

export async function fetchRepCampaignPreview(
  scope: RepCampaignScope,
  commercialCount: number,
  spreadDays: number,
  client: ApiClient = getApiClient(),
): Promise<RepCampaignPreview> {
  const query: NonNullable<operations['previewRepCampaign']['parameters']['query']> = {
    commercialCount: Math.max(1, commercialCount),
    spreadDays,
    onlyWithoutProspects: scope.onlyWithoutProspects,
  };
  if (scope.departementId !== null) query.departementId = scope.departementId;
  if (scope.iefId !== null) query.iefId = scope.iefId;

  return unwrap(await client.GET('/api/v1/rep-campaigns/preview', { params: { query } }));
}

export function repProgrammePdfUrl(campaignId: string, userId: string, day?: number): string {
  const base = `/api/v1/rep-campaigns/${encodeURIComponent(campaignId)}/commerciaux/${encodeURIComponent(userId)}/programme.pdf`;
  return day === undefined ? base : `${base}?jour=${String(day)}`;
}

export function repProgrammePdfFileName(
  campaignName: string,
  commercialName: string,
  day?: number,
): string {
  const suffix = day === undefined ? '' : `-jour-${String(day)}`;
  return `programme-representants-${slugForFileName(campaignName)}-${slugForFileName(commercialName)}${suffix}.pdf`;
}
