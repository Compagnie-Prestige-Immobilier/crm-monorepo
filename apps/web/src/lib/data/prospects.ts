import type { ApiClient } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { flattenPage, toProspectQuery } from '@/lib/api/query-params';
import type { Paginated, ProspectFilters, ProspectRow, UpdateProspectInput } from '@/lib/types';

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
