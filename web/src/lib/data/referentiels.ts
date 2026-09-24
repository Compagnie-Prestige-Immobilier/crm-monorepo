import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { toFilterQuery } from '@/lib/api/query-params';
import { EMPTY_FILTERS } from '@/lib/filters';
import type {
  Banque,
  Departement,
  Employeur,
  IncomeBand,
  Offer,
  Profession,
  Syndicat,
} from '@/lib/types';

type ReferentielEntree = components['schemas']['ReferentielsEntree'];
export type CreateBanqueInput = ReferentielEntree;
export type UpdateBanqueInput = ReferentielEntree;
export type CreateSyndicatInput = ReferentielEntree;
export type UpdateSyndicatInput = ReferentielEntree;
export type CreateDepartementInput = ReferentielEntree;
export type UpdateDepartementInput = ReferentielEntree;

export async function saveReferentiel(
  kind: string,
  input: ReferentielEntree & { id?: string },
  client: ApiClient = getApiClient(),
): Promise<components['schemas']['ReferentielsItem']> {
  const { id, ...body } = input;
  if (id !== undefined) {
    return unwrap(
      await client.PATCH('/api/v1/referentiels/{kind}/{id}', {
        params: { path: { kind, id } },
        body,
      }),
    );
  }
  return unwrap(
    await client.POST('/api/v1/referentiels/{kind}', { params: { path: { kind } }, body }),
  );
}

export async function saveProfession(
  input: ReferentielEntree & { id?: string },
  client: ApiClient = getApiClient(),
): Promise<Profession> {
  return saveReferentiel('professions', input, client);
}

export async function saveIncomeBand(
  input: ReferentielEntree & { id?: string },
  client: ApiClient = getApiClient(),
): Promise<IncomeBand> {
  return saveReferentiel('tranches-revenu', input, client);
}

export async function saveEmployeur(
  input: ReferentielEntree & { id?: string },
  client: ApiClient = getApiClient(),
): Promise<Employeur> {
  return saveReferentiel('employeurs', input, client);
}

export async function saveOffer(
  input: ReferentielEntree & { id?: string },
  client: ApiClient = getApiClient(),
): Promise<Offer> {
  return saveReferentiel('offres', input, client);
}

export async function createBanque(
  input: CreateBanqueInput,
  client: ApiClient = getApiClient(),
): Promise<Banque> {
  return unwrap(
    await client.POST('/api/v1/referentiels/{kind}', {
      params: { path: { kind: 'banques' } },
      body: input,
    }),
  );
}

export async function updateBanque(
  id: string,
  patch: UpdateBanqueInput,
  client: ApiClient = getApiClient(),
): Promise<Banque> {
  return unwrap(
    await client.PATCH('/api/v1/referentiels/{kind}/{id}', {
      params: { path: { kind: 'banques', id } },
      body: patch,
    }),
  );
}

export async function createSyndicat(
  input: CreateSyndicatInput,
  client: ApiClient = getApiClient(),
): Promise<Syndicat> {
  return unwrap(
    await client.POST('/api/v1/referentiels/{kind}', {
      params: { path: { kind: 'syndicats' } },
      body: input,
    }),
  );
}

export async function updateSyndicat(
  id: string,
  patch: UpdateSyndicatInput,
  client: ApiClient = getApiClient(),
): Promise<Syndicat> {
  return unwrap(
    await client.PATCH('/api/v1/referentiels/{kind}/{id}', {
      params: { path: { kind: 'syndicats', id } },
      body: patch,
    }),
  );
}

export async function createDepartement(
  input: CreateDepartementInput,
  client: ApiClient = getApiClient(),
): Promise<Departement> {
  return unwrap(
    await client.POST('/api/v1/referentiels/{kind}', {
      params: { path: { kind: 'departements' } },
      body: input,
    }),
  );
}

export async function updateDepartement(
  id: string,
  patch: UpdateDepartementInput,
  client: ApiClient = getApiClient(),
): Promise<Departement> {
  return unwrap(
    await client.PATCH('/api/v1/referentiels/{kind}/{id}', {
      params: { path: { kind: 'departements', id } },
      body: patch,
    }),
  );
}

export type UsageCounts = Readonly<Record<string, number>>;

export interface ReferentielUsage {
  banques: UsageCounts;
  syndicats: UsageCounts;
  departements: UsageCounts;
}

function tally(items: readonly { id?: string | null; prospects: number }[]): UsageCounts {
  const counts: Record<string, number> = {};
  for (const item of items) {
    if (item.id === null || item.id === undefined) continue;
    counts[item.id] = item.prospects;
  }
  return counts;
}

export async function fetchReferentielUsage(
  client: ApiClient = getApiClient(),
): Promise<ReferentielUsage> {
  const query = toFilterQuery(EMPTY_FILTERS);
  const [banques, syndicats, departements] = await Promise.all([
    client.GET('/api/v1/analytics/by-banque', { params: { query } }),
    client.GET('/api/v1/analytics/by-syndicat', { params: { query } }),
    client.GET('/api/v1/analytics/by-departement', { params: { query } }),
  ]);

  return {
    banques: tally(unwrap(banques).items),
    syndicats: tally(unwrap(syndicats).items),
    departements: tally(unwrap(departements).items),
  };
}
