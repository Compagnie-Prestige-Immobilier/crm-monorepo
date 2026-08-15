import type { ApiClient, components, operations } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { flattenPage } from '@/lib/api/query-params';
import { slugForFileName } from '@/lib/data/phase2';
import type { RepCampaignFilters } from '@/lib/rep-campaign-filters';
import type { Paginated } from '@/lib/types';

/**
 * Campagnes d'appels REPRÉSENTANTS. Réservé à l'ADMIN côté API.
 *
 * Module séparé de `lib/data/phase2.ts` et non paramétré : côté serveur ce sont
 * deux modules, deux jeux de tables et deux garde-fous. Une abstraction commune
 * ferait croire qu'un changement de l'un vaut pour l'autre, et c'est
 * exactement ce qu'on a voulu éviter en séparant les tables : la première
 * campagne du produit (appeler les représentants) ne doit rien pouvoir casser
 * dans les campagnes prospects, qui tournent en production.
 *
 * Le seul emprunt est cosmétique : `slugForFileName`, pour que les deux liasses
 * qu'un téléconseiller reçoit le même matin portent des noms de la même famille.
 */

type Schemas = components['schemas'];

export type RepCampaignSummary = Schemas['RepCampaignSummaryDto'];
export type RepCampaignDetail = Schemas['RepCampaignDetailDto'];
export type RepCampaignCommercial = Schemas['RepCampaignCommercialDto'];
export type RepCampaignPreview = Schemas['RepCampaignPreviewDto'];
export type CreateRepCampaignInput = Schemas['CreateRepCampaignDto'];

type RepCampaignQuery = NonNullable<operations['listRepCampaigns']['parameters']['query']>;

/**
 * Bornes de journée explicitées, comme partout ailleurs : sans heure,
 * `dateTo=2026-08-12` serait lu comme minuit pile et exclurait toute la
 * journée du 12. L'heure métier est `Africa/Dakar`, soit UTC+0 toute l'année.
 */
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

// ─── Aperçu du tirage ───────────────────────────────────────────────────────

export interface RepCampaignScope {
  departementId: string | null;
  iefId: string | null;
  onlyWithoutProspects: boolean;
}

/**
 * Ici l'aperçu vient du SERVEUR, contrairement aux campagnes prospects.
 *
 * L'éligibilité d'un représentant dépend de son rattachement, de la présence de
 * prospects vivants et des campagnes en cours : trois questions que seule la
 * base sait trancher d'un coup. Reproduire la règle ici donnerait un chiffre
 * qui diverge du tirage réel dès qu'une campagne concurrente est ouverte.
 */
export async function fetchRepCampaignPreview(
  scope: RepCampaignScope,
  commercialCount: number,
  spreadDays: number,
  client: ApiClient = getApiClient(),
): Promise<RepCampaignPreview> {
  // `exactOptionalPropertyTypes` : une clé posée à `undefined` n'est pas une
  // clé absente, et `openapi-fetch` la sérialiserait en `departementId=undefined`.
  const query: NonNullable<operations['previewRepCampaign']['parameters']['query']> = {
    commercialCount: Math.max(1, commercialCount),
    spreadDays,
    onlyWithoutProspects: scope.onlyWithoutProspects,
  };
  if (scope.departementId !== null) query.departementId = scope.departementId;
  if (scope.iefId !== null) query.iefId = scope.iefId;

  return unwrap(await client.GET('/api/v1/rep-campaigns/preview', { params: { query } }));
}

// ─── Programme imprimable ───────────────────────────────────────────────────

/**
 * URL du programme PDF d'un téléconseiller.
 *
 * Elle vise le relais `/api/v1/*` de Next et non l'API directement : le jeton
 * vit dans un cookie `httpOnly`, hors de portée de `fetch` côté client, et un
 * `<a href>` vers NestJS partirait anonyme.
 */
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

/**
 * Le LIBELLÉ du périmètre n'est jamais composé ici.
 *
 * `scopeLabel` est renvoyé par l'aperçu comme par le détail, et c'est
 * volontaire : le périmètre est une règle métier (département, IEF, dormants
 * cumulables), et deux formulations pour la même chose feraient douter que
 * l'aperçu et la campagne créée portent bien sur la même population.
 */
