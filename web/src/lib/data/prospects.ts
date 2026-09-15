import type { ApiClient, components } from '@crm/api-client';
import { ApiError, unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { flattenPage, toProspectQuery, type ProspectQuery } from '@/lib/api/query-params';
import type { OrigineFiche } from '@/lib/data/grand-public';
import { SUIVI_PAGE_SIZE } from '@/lib/data/representants';
import type {
  BddSegment,
  Paginated,
  Projet,
  ProspectFilters,
  ProspectRow,
  UpdateProspectInput,
} from '@/lib/types';

export type CreateProspectInput = components['schemas']['CreateProspectDto'];
export type ProspectPhoneConflict = components['schemas']['ProspectConflictExistingDto'];

export async function fetchProspects(
  filters: ProspectFilters,
  client: ApiClient = getApiClient(),
): Promise<Paginated<ProspectRow>> {
  const payload = unwrap(
    await client.GET('/api/v1/prospects', { params: { query: toProspectQuery(filters) } }),
  );
  return flattenPage(payload);
}

/** L'annuaire de l'écran d'appel : une page tient sous le pouce. */
const A_QUALIFIER_PAGE_SIZE = 20;

/**
 * Ce que l'écran d'appel a le droit d'appeler : ses propres fiches et celles
 * qu'une campagne lui a confiées. Ne passe pas par `ProspectFilters` : ce n'est
 * pas un critère que l'utilisateur pose, c'est la portée de l'écran, et elle
 * vaut pour tous les rôles, encadrement compris.
 */
export async function fetchProspectsAQualifier(
  criteres: {
    projet: Projet | null;
    search: string;
    origine?: OrigineFiche | undefined;
    viewerId?: string | undefined;
    resteAAppeler?: boolean | undefined;
    /** Les fiches plateforme se prennent dans l'ordre d'arrivée, la plus récente d'abord. */
    plateforme?: boolean | undefined;
  },
  client: ApiClient = getApiClient(),
): Promise<Paginated<ProspectRow>> {
  const origine = criteres.origine ?? 'TOUS';
  const query: ProspectQuery = {
    mesFiches: true,
    ...(criteres.resteAAppeler === true ? { resteAAppeler: true } : {}),
    ...(criteres.projet === null ? {} : { projet: criteres.projet }),
    search: criteres.search,
    sortBy: criteres.plateforme === true ? 'plateformeDepuis' : 'nom',
    sortOrder: criteres.plateforme === true ? 'desc' : 'asc',
    page: 1,
    pageSize: A_QUALIFIER_PAGE_SIZE,
    ...(origine === 'MOI' && criteres.viewerId !== undefined
      ? { commercialId: criteres.viewerId }
      : {}),
    ...(origine === 'CAMPAGNE' ? { attribue: true } : {}),
  };
  return flattenPage(unwrap(await client.GET('/api/v1/prospects', { params: { query } })));
}

/** Les prospects dont ce téléconseiller a passé le DERNIER appel, du plus récent au plus ancien. */
export async function fetchProspectsAppeles(
  lastCallById: string,
  projet: Projet | null | undefined,
  client: ApiClient = getApiClient(),
): Promise<Paginated<ProspectRow>> {
  const payload = unwrap(
    await client.GET('/api/v1/prospects', {
      params: {
        query: {
          lastCallById,
          ...(projet === null || projet === undefined ? {} : { projet }),
          sortBy: 'lastCallAt',
          sortOrder: 'desc',
          page: 1,
          pageSize: SUIVI_PAGE_SIZE,
        },
      },
    }),
  );
  return flattenPage(payload);
}

export async function fetchProspect(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<ProspectRow> {
  return unwrap(await client.GET('/api/v1/prospects/{id}', { params: { path: { id } } }));
}

export type ProspectCallAttempt = components['schemas']['ProspectCallAttemptDto'];

export async function fetchProspectCallAttempts(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<ProspectCallAttempt[]> {
  const payload = unwrap(
    await client.GET('/api/v1/prospects/{id}/call-attempts', { params: { path: { id } } }),
  );
  return payload.items;
}

export type DeviceCallDetection = components['schemas']['DeviceCallDetectionDto'];

/** Les relevés du téléphone venaient de l'application mobile, abandonnée : la liste reste vide. */
export async function fetchProspectDeviceCalls(_id: string): Promise<DeviceCallDetection[]> {
  return [];
}

export async function createProspect(
  input: CreateProspectInput,
  client: ApiClient = getApiClient(),
): Promise<ProspectRow> {
  return unwrap(await client.POST('/api/v1/prospects', { body: input }));
}

/** La fiche que le 409 nomme, ou `null` si l'échec est d'une autre nature. */
export function prospectPhoneConflict(error: unknown): ProspectPhoneConflict | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const body = error.body as Partial<components['schemas']['ProspectConflictDto']> | null;
  if (typeof body !== 'object' || body === null) return null;
  if (body.code !== 'PROSPECT_PHONE_CONFLICT' || body.existing === undefined) return null;
  return body.existing;
}

export async function updateProspect(
  id: string,
  patch: UpdateProspectInput,
  client: ApiClient = getApiClient(),
): Promise<ProspectRow> {
  return unwrap(
    await client.PATCH('/api/v1/prospects/{id}', { params: { path: { id } }, body: patch }),
  );
}

/** La revue du closing, avant transmission à l'enrôlement. */
export async function marquerProspectRevue(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<ProspectRow> {
  return unwrap(await client.POST('/api/v1/prospects/{id}/revue', { params: { path: { id } } }));
}

export async function deleteProspect(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<void> {
  unwrap(await client.DELETE('/api/v1/prospects/{id}', { params: { path: { id } } }));
}

export interface MergeInput {
  targetId: string;
  sourceId: string;
  preferSource: boolean;
}

export async function mergeProspects(
  input: MergeInput,
  client: ApiClient = getApiClient(),
): Promise<ProspectRow> {
  return unwrap(await client.POST('/api/v1/prospects/merge', { body: input }));
}

export interface ReassignInput {
  prospectIds: string[];
  representantId?: string | undefined;
  commercialId?: string | undefined;
}

export interface ReassignResult {
  updated: number;
  prospectIds: string[];
}

export interface SegmentChangeRow {
  id: string;
  prospectId: string;
  fromSegment: BddSegment;
  toSegment: BddSegment;
  fromBanqueId: string;
  toBanqueId: string;
  fromSyndicatId: string;
  toSyndicatId: string;
  reason: string | null;
  changedById: string;
  changedByName: string;
  source: 'WEB' | 'MOBILE';
  changedAt: string;
}

export interface ChangeSegmentInput {
  banqueId?: string | undefined;
  syndicatId?: string | undefined;
  reason: string;
  expectedRev: number;
}

async function callRelay<TData>(
  path: string,
  init: RequestInit,
  fetchImpl: typeof globalThis.fetch,
): Promise<TData> {
  const response = await fetchImpl(path, init);
  const text = await response.text();
  const body: unknown = text === '' ? undefined : JSON.parse(text);

  return unwrap<TData, unknown>(
    response.ok ? { data: body as TData, response } : { error: body ?? {}, response },
  );
}

export async function changeProspectSegment(
  id: string,
  input: ChangeSegmentInput,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<ProspectRow> {
  const body: Record<string, string | number> = {
    reason: input.reason,
    expectedRev: input.expectedRev,
  };
  if (input.banqueId !== undefined) body.banqueId = input.banqueId;
  if (input.syndicatId !== undefined) body.syndicatId = input.syndicatId;

  return callRelay<ProspectRow>(
    `/api/v1/prospects/${encodeURIComponent(id)}/segment`,
    {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
    fetchImpl,
  );
}

export async function fetchProspectSegmentHistory(
  id: string,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<SegmentChangeRow[]> {
  const page = await callRelay<{ items: SegmentChangeRow[] }>(
    `/api/v1/prospects/${encodeURIComponent(id)}/segment-history`,
    { method: 'GET' },
    fetchImpl,
  );
  return page.items;
}

export async function reassignProspects(
  input: ReassignInput,
  client: ApiClient = getApiClient(),
): Promise<ReassignResult> {
  const body: {
    prospectIds: string[];
    representantId?: string;
    commercialId?: string;
  } = { prospectIds: input.prospectIds };
  if (input.representantId !== undefined) body.representantId = input.representantId;
  if (input.commercialId !== undefined) body.commercialId = input.commercialId;

  return unwrap(await client.POST('/api/v1/prospects/reassign', { body }));
}
