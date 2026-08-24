import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';

export type VisiteReferentielKind = components['schemas']['VisiteReferentielKind'];
export type VisiteReferentielEntry = components['schemas']['VisiteReferentielDto'];
export type CreateVisiteReferentielInput = components['schemas']['CreateVisiteReferentielDto'];
export type UpdateVisiteReferentielInput = components['schemas']['UpdateVisiteReferentielDto'];

export const VISITE_REFERENTIEL_KINDS: readonly VisiteReferentielKind[] = [
  'entreprises',
  'directions',
  'destinataires',
  'objets',
];

export type UsageCounts = Readonly<Record<string, number>>;

export interface VisiteReferentielUsage {
  entreprises: UsageCounts;
  directions: UsageCounts;
  destinataires: UsageCounts;
  objets: UsageCounts;
}

function tally(entries: readonly { id: string; count: number }[]): UsageCounts {
  const counts: Record<string, number> = {};
  for (const entry of entries) counts[entry.id] = entry.count;
  return counts;
}

export async function fetchVisiteReferentielList(
  kind: VisiteReferentielKind,
  client: ApiClient = getApiClient(),
): Promise<VisiteReferentielEntry[]> {
  return unwrap(
    await client.GET('/api/v1/visites/referentiels/{kind}', {
      params: { path: { kind }, query: { activeOnly: false } },
    }),
  ).items;
}

export async function createVisiteReferentiel(
  kind: VisiteReferentielKind,
  input: CreateVisiteReferentielInput,
  client: ApiClient = getApiClient(),
): Promise<VisiteReferentielEntry> {
  return unwrap(
    await client.POST('/api/v1/visites/referentiels/{kind}', {
      params: { path: { kind } },
      body: input,
    }),
  );
}

export async function updateVisiteReferentiel(
  kind: VisiteReferentielKind,
  id: string,
  patch: UpdateVisiteReferentielInput,
  client: ApiClient = getApiClient(),
): Promise<VisiteReferentielEntry> {
  return unwrap(
    await client.PATCH('/api/v1/visites/referentiels/{kind}/{id}', {
      params: { path: { kind, id } },
      body: patch,
    }),
  );
}

export async function setVisiteReferentielActive(
  kind: VisiteReferentielKind,
  id: string,
  isActive: boolean,
  client: ApiClient = getApiClient(),
): Promise<VisiteReferentielEntry> {
  return unwrap(
    await client.POST('/api/v1/visites/referentiels/{kind}/{id}/active', {
      params: { path: { kind, id } },
      body: { isActive },
    }),
  );
}

export async function reorderVisiteReferentiel(
  kind: VisiteReferentielKind,
  ids: string[],
  client: ApiClient = getApiClient(),
): Promise<VisiteReferentielEntry[]> {
  return unwrap(
    await client.POST('/api/v1/visites/referentiels/{kind}/reorder', {
      params: { path: { kind } },
      body: { ids },
    }),
  ).items;
}

export async function fetchVisiteReferentielUsage(
  client: ApiClient = getApiClient(),
): Promise<VisiteReferentielUsage> {
  const response = unwrap(await client.GET('/api/v1/visites/referentiels/usage'));
  return {
    entreprises: tally(response.entreprises),
    directions: tally(response.directions),
    destinataires: tally(response.destinataires),
    objets: tally(response.objets),
  };
}
