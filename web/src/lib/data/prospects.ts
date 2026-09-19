import type { ApiClient, components } from '@crm/api-client';
import { ApiError, unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { flattenPage, toProspectQuery, type ProspectQuery } from '@/lib/api/query-params';
import type { OrigineFiche } from '@/lib/data/grand-public';
import { SUIVI_PAGE_SIZE } from '@/lib/data/representants';
import type {
  BddSegment,
  DeviceCallDetection,
  Paginated,
  Projet,
  ProspectFilters,
  ProspectRow,
  ProspectStatut,
  UpdateProspectInput,
} from '@/lib/types';

export type { DeviceCallDetection };
export type CreateProspectInput = components['schemas']['ProspectBody'];

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
function buildOrigineFilter(
  origine: OrigineFiche,
  viewerId: string | undefined,
): Record<string, unknown> {
  if (origine === 'MOI' && viewerId !== undefined) return { commercialId: viewerId };
  if (origine === 'CAMPAGNE') return { attribue: true };
  return {};
}

function buildExtraFilters(criteres: {
  representantId?: string | null;
  departementId?: string | null;
  banqueId?: string | null;
  syndicatId?: string | null;
  statut?: string | null;
  canalProvenanceId?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
}): Partial<ProspectQuery> {
  return {
    ...(criteres.representantId ? { representantId: criteres.representantId } : {}),
    ...(criteres.departementId ? { departementId: criteres.departementId } : {}),
    ...(criteres.banqueId ? { banqueId: criteres.banqueId } : {}),
    ...(criteres.syndicatId ? { syndicatId: criteres.syndicatId } : {}),
    ...(criteres.statut ? { statut: criteres.statut as ProspectStatut } : {}),
    ...(criteres.canalProvenanceId ? { canalProvenanceId: criteres.canalProvenanceId } : {}),
    ...(criteres.dateFrom ? { dateFrom: criteres.dateFrom } : {}),
    ...(criteres.dateTo ? { dateTo: criteres.dateTo } : {}),
  };
}

function buildAQualifierQuery(
  criteres: {
    projet: Projet | null;
    search: string;
    origine?: OrigineFiche | undefined;
    viewerId?: string | undefined;
    resteAAppeler?: boolean | undefined;
    tous?: boolean | undefined;
    page: number;
    representantId?: string | null;
    departementId?: string | null;
    banqueId?: string | null;
    syndicatId?: string | null;
    statut?: string | null;
    canalProvenanceId?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  },
  origine: OrigineFiche,
): ProspectQuery {
  const base: ProspectQuery = {
    mesFiches: criteres.tous !== true,
    search: criteres.search,
    sortBy: 'nom',
    sortOrder: 'asc',
    page: criteres.page,
    pageSize: A_QUALIFIER_PAGE_SIZE,
  };

  const projectFilter = criteres.projet === null ? {} : { projet: criteres.projet };
  const resteFilter = criteres.resteAAppeler === true ? { resteAAppeler: true } : {};
  const origineFilter = buildOrigineFilter(origine, criteres.viewerId);
  const extraFilters = buildExtraFilters(criteres);

  return { ...base, ...projectFilter, ...resteFilter, ...origineFilter, ...extraFilters };
}

export async function fetchProspectsAQualifier(
  criteres: {
    projet: Projet | null;
    search: string;
    origine?: OrigineFiche | undefined;
    viewerId?: string | undefined;
    resteAAppeler?: boolean | undefined;
    /** L'encadrement regarde le travail de tous, il ne compose aucun numéro. */
    tous?: boolean | undefined;
    /** La page demandée : la liste entière se parcourt, vingt fiches à la fois. */
    page: number;
    representantId?: string | null;
    departementId?: string | null;
    banqueId?: string | null;
    syndicatId?: string | null;
    statut?: string | null;
    canalProvenanceId?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  },
  client: ApiClient = getApiClient(),
): Promise<Paginated<ProspectRow>> {
  const origine = criteres.origine ?? 'TOUS';
  const query = buildAQualifierQuery(criteres, origine);
  return flattenPage(unwrap(await client.GET('/api/v1/prospects', { params: { query } })));
}

export type PipelineContacts = components['schemas']['ProspectPipelineOutputBody'];
export type ClientContact = components['schemas']['ProspectClient'];

/** Les clients d'un téléconseiller : ses contacts vendus, avec la vente rapprochée par téléphone. */
export async function fetchClientsContacts(
  appelePar: string,
  projet: Projet | null | undefined,
  client: ApiClient = getApiClient(),
): Promise<ClientContact[]> {
  return unwrap(
    await client.GET('/api/v1/prospects/clients', {
      params: {
        query: { appelePar, ...(projet === null || projet === undefined ? {} : { projet }) },
      },
    }),
  ).items;
}

/** Le parcours d'un téléconseiller sur ses contacts, de l'appel à la vente. */
export async function fetchPipelineContacts(
  appelePar: string,
  projet: Projet | null | undefined,
  client: ApiClient = getApiClient(),
): Promise<PipelineContacts> {
  return unwrap(
    await client.GET('/api/v1/prospects/pipeline', {
      params: {
        query: { appelePar, ...(projet === null || projet === undefined ? {} : { projet }) },
      },
    }),
  );
}

/** Les prospects dont ce téléconseiller a passé le DERNIER appel, du plus récent au plus ancien. */
export async function fetchProspectsAppeles(
  appelePar: string,
  projet: Projet | null | undefined,
  client: ApiClient = getApiClient(),
): Promise<Paginated<ProspectRow>> {
  const payload = unwrap(
    await client.GET('/api/v1/prospects', {
      params: {
        query: {
          appelePar,
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

export type ProspectCallAttempt = components['schemas']['ProspectCallAttempt'];

export async function fetchProspectCallAttempts(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<ProspectCallAttempt[]> {
  const payload = unwrap(
    await client.GET('/api/v1/prospects/{id}/call-attempts', { params: { path: { id } } }),
  );
  return payload.items;
}

export type ProspectRequalification = components['schemas']['ProspectRequalification'];

export async function fetchProspectRequalifications(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<ProspectRequalification[]> {
  const payload = unwrap(
    await client.GET('/api/v1/prospects/{id}/requalifications', { params: { path: { id } } }),
  );
  return payload.items;
}

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

/** Absent du contrat Go : `huma.ErrorDetail.value` n'est pas typé au delà de `unknown`. */
export interface ProspectPhoneConflict {
  id?: string;
  nom?: string;
  prenom?: string;
  representantId?: string | null;
  representantName?: string | null;
  ownedByCommercialId?: string;
  ownedByCommercialName: string;
  createdAt?: string;
}

/**
 * La fiche que le 409 nomme, ou `null` si l'échec est d'une autre nature.
 * Le Go la place dans `errors[].value` à `location: "existing"`, jamais à la
 * racine du corps (`prospectTelephoneLibre` dans `internal/prospects/prospects.go`).
 */
export function prospectPhoneConflict(error: unknown): ProspectPhoneConflict | null {
  if (!(error instanceof ApiError) || error.status !== 409) return null;
  const body = error.body as components['schemas']['ProblemError'] | null;
  if (typeof body !== 'object' || body === null || body.code !== 'PROSPECT_PHONE_CONFLICT') {
    return null;
  }
  const detail = body.errors?.find((entry) => entry.location === 'existing');
  return (detail?.value as ProspectPhoneConflict | undefined) ?? null;
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

/** Le closing confirme la vente : la fiche convertie devient vendue. */
export async function marquerProspectVendu(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<ProspectRow> {
  return unwrap(await client.POST('/api/v1/prospects/{id}/vendre', { params: { path: { id } } }));
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

/** Une ligne du journal de la fiche : qui, quand, quoi, avec l'avant et l'après. */
export interface ProspectJournalEntry {
  id: string;
  action: string;
  entite: string;
  at: string;
  auteur: string;
  avant: Record<string, unknown>;
  apres: Record<string, unknown>;
}

export async function fetchProspectJournal(
  id: string,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<ProspectJournalEntry[]> {
  const page = await callRelay<{ items: ProspectJournalEntry[] }>(
    `/api/v1/prospects/${encodeURIComponent(id)}/journal`,
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

/** Remise à traiter : la fiche revient dans le reste à appeler, les appels passés restent. */
export async function remettreProspectATraiter(
  id: string,
  projet: 'CHUES' | 'GRAND_PUBLIC',
  client: ApiClient = getApiClient(),
): Promise<ProspectRow> {
  return unwrap(
    await client.POST('/api/v1/prospects/{id}/requalifier', {
      params: { path: { id } },
      body: { projet, statut: 'NOUVEAU' },
    }),
  );
}

/** Un téléconseiller nommé, ou une campagne en cours qui désigne son membre le moins chargé. */
export type AffectationCible = { teleconseillerId: string } | { campagneId: string };

/** L'encadrement confie la fiche ; campagnes en cours et rappel promis suivent. */
export async function affecterProspect(
  id: string,
  destination: AffectationCible,
  client: ApiClient = getApiClient(),
): Promise<void> {
  unwrap(
    await client.POST('/api/v1/prospects/{id}/affecter', {
      params: { path: { id } },
      body: destination,
    }),
  );
}

/** L'encadrement pose le motif sans appel ; la fiche suit son effet. */
export async function suivreRendezVous(
  id: string,
  body: components['schemas']['ProspectSuiviRendezVousInputBody'],
  client: ApiClient = getApiClient(),
): Promise<ProspectRow> {
  return unwrap(
    await client.POST('/api/v1/prospects/{id}/suivi-rendez-vous', {
      params: { path: { id } },
      body,
    }),
  );
}

export async function poserMotifProspect(
  id: string,
  body: { reasonCode: string; callbackAt?: string },
  client: ApiClient = getApiClient(),
): Promise<void> {
  unwrap(
    await client.POST('/api/v1/prospects/{id}/statut-qualification', {
      params: { path: { id } },
      body,
    }),
  );
}
