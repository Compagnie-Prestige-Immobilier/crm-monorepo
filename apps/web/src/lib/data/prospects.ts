import type { ApiClient } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { flattenPage, toProspectQuery } from '@/lib/api/query-params';
import type {
  BddSegment,
  Paginated,
  ProspectFilters,
  ProspectRow,
  UpdateProspectInput,
} from '@/lib/types';

/**
 * Prospects : `GET /prospects` et ses mutations.
 *
 * Le filtrage, le tri et la pagination sont exécutés CÔTÉ SERVEUR, en SQL.
 * Rapatrier la table pour trier dans le navigateur bloquerait l'onglet dès
 * quelques milliers de lignes (elle grossit d'une centaine par semaine de
 * tournée) et ferait sortir des données hors du périmètre filtré.
 */

export async function fetchProspects(
  filters: ProspectFilters,
  client: ApiClient = getApiClient(),
): Promise<Paginated<ProspectRow>> {
  const payload = unwrap(
    await client.GET('/api/v1/prospects', { params: { query: toProspectQuery(filters) } }),
  );
  return flattenPage(payload);
}

export async function fetchProspect(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<ProspectRow> {
  return unwrap(await client.GET('/api/v1/prospects/{id}', { params: { path: { id } } }));
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

/** Suppression logique : le numéro redevient ressaisissable sur le terrain. */
export async function deleteProspect(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<void> {
  unwrap(await client.DELETE('/api/v1/prospects/{id}', { params: { path: { id } } }));
}

export interface MergeInput {
  /** La fiche CONSERVÉE. */
  targetId: string;
  /** La fiche absorbée, puis supprimée logiquement. */
  sourceId: string;
  /** Recopier nom, prénom, banque, syndicat et statut de la source sur la cible. */
  preferSource: boolean;
}

/**
 * Fusion de deux doublons. L'opération n'est PAS réversible côté API : la
 * source part en suppression logique et ses prospects suivent la cible.
 * L'écran doit donc nommer la survivante avant de laisser cliquer.
 */
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

/* ─── Migration de segment ─────────────────────────────────────────────────
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI CES DEUX APPELS NE PASSENT PAS PAR LE CLIENT GÉNÉRÉ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `@crm/api-client` est ENGENDRÉ depuis `apps/api/openapi.json`, et le contrat
 * est régénéré par la CI (`pnpm codegen`), jamais à la main dans une branche de
 * travail : deux routes ajoutées le même jour dans deux chantiers différents
 * produiraient sinon deux contrats qui s'écrasent l'un l'autre.
 *
 * Ces deux routes-ci sont donc absentes du client tant que la régénération n'a
 * pas eu lieu, et `client.PATCH('/api/v1/prospects/{id}/segment')` ne
 * compilerait pas. On frappe le relais directement, EXACTEMENT comme le fait le
 * client : même origine, donc même cookie `httpOnly`, et le jeton reste hors de
 * portée du JavaScript de la page.
 *
 * Le seul point qui compte est l'ERREUR : elle repasse par `unwrap`, donc par
 * `ApiError`, donc par `toastApiError` et sa traduction des refus transverses
 * du mode démonstration. Un `fetch` qui court-circuiterait ce passage rendrait
 * un échec indiscernable d'un succès vide.
 *
 * À REMPLACER par `client.PATCH(...)` / `client.GET(...)` dès la première
 * régénération du contrat : ce détour n'a aucune autre raison d'être.
 */

/** Une bascule déjà écrite, telle que l'API la rend. */
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
  /** Obligatoire côté API : une bascule sans motif est refusée en 400. */
  reason: string;
  /** Révision lue à l'affichage. Un écart renvoie PROSPECT_REV_CONFLICT. */
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

  // `unwrap` distingue le succès de l'échec sur la seule présence d'`error` :
  // on lui donne donc la même forme que le client généré, et il lève un
  // `ApiError` porteur du statut et du corps parsé.
  return unwrap<TData, unknown>(
    response.ok ? { data: body as TData, response } : { error: body ?? {}, response },
  );
}

/**
 * Fait basculer un prospect de segment.
 *
 * `exactOptionalPropertyTypes` : une clé présente avec `undefined` n'est pas
 * une clé absente, et `forbidNonWhitelisted` côté API refuse le corps en 400.
 */
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
  // `exactOptionalPropertyTypes` : une clé présente avec `undefined` n'est pas
  // la même chose qu'une clé absente, et l'API traiterait la première comme
  // « réaffecter à personne ».
  const body: {
    prospectIds: string[];
    representantId?: string;
    commercialId?: string;
  } = { prospectIds: input.prospectIds };
  if (input.representantId !== undefined) body.representantId = input.representantId;
  if (input.commercialId !== undefined) body.commercialId = input.commercialId;

  return unwrap(await client.POST('/api/v1/prospects/reassign', { body }));
}
