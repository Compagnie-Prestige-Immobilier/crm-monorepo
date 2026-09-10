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

export type CreateBanqueInput = components['schemas']['CreateBanqueDto'];
export type UpdateBanqueInput = components['schemas']['UpdateBanqueDto'];
export type CreateSyndicatInput = components['schemas']['CreateSyndicatDto'];
export type UpdateSyndicatInput = components['schemas']['UpdateSyndicatDto'];
export type CreateDepartementInput = components['schemas']['CreateDepartementDto'];
export type UpdateDepartementInput = components['schemas']['UpdateDepartementDto'];

export async function saveProfession(
  input: components['schemas']['CreateProfessionDto'] & { id?: string },
  client: ApiClient = getApiClient(),
): Promise<Profession> {
  const { id, ...body } = input;
  if (id) {
    return unwrap(
      await client.PATCH('/api/v1/referentiels/professions/{id}', {
        params: { path: { id } },
        body,
      }),
    );
  }
  return unwrap(await client.POST('/api/v1/referentiels/professions', { body }));
}

export async function saveIncomeBand(
  input: components['schemas']['CreateIncomeBandDto'] & { id?: string },
  client: ApiClient = getApiClient(),
): Promise<IncomeBand> {
  const { id, ...body } = input;
  if (id) {
    return unwrap(
      await client.PATCH('/api/v1/referentiels/tranches-revenu/{id}', {
        params: { path: { id } },
        body,
      }),
    );
  }
  return unwrap(await client.POST('/api/v1/referentiels/tranches-revenu', { body }));
}

export async function saveEmployeur(
  input: components['schemas']['CreateEmployeurDto'] & { id?: string },
  client: ApiClient = getApiClient(),
): Promise<Employeur> {
  const { id, ...body } = input;
  if (id) {
    return unwrap(
      await client.PATCH('/api/v1/referentiels/employeurs/{id}', {
        params: { path: { id } },
        body,
      }),
    );
  }
  return unwrap(await client.POST('/api/v1/referentiels/employeurs', { body }));
}

export async function saveOffer(
  input: components['schemas']['CreateOfferDto'] & { id?: string },
  client: ApiClient = getApiClient(),
): Promise<Offer> {
  const { id, ...body } = input;
  if (id) {
    return unwrap(
      await client.PATCH('/api/v1/referentiels/offres/{id}', {
        params: { path: { id } },
        body,
      }),
    );
  }
  return unwrap(await client.POST('/api/v1/referentiels/offres', { body }));
}

export async function createBanque(
  input: CreateBanqueInput,
  client: ApiClient = getApiClient(),
): Promise<Banque> {
  return unwrap(await client.POST('/api/v1/referentiels/banques', { body: input }));
}

export async function updateBanque(
  id: string,
  patch: UpdateBanqueInput,
  client: ApiClient = getApiClient(),
): Promise<Banque> {
  return unwrap(
    await client.PATCH('/api/v1/referentiels/banques/{id}', {
      params: { path: { id } },
      body: patch,
    }),
  );
}

export async function createSyndicat(
  input: CreateSyndicatInput,
  client: ApiClient = getApiClient(),
): Promise<Syndicat> {
  return unwrap(await client.POST('/api/v1/referentiels/syndicats', { body: input }));
}

export async function updateSyndicat(
  id: string,
  patch: UpdateSyndicatInput,
  client: ApiClient = getApiClient(),
): Promise<Syndicat> {
  return unwrap(
    await client.PATCH('/api/v1/referentiels/syndicats/{id}', {
      params: { path: { id } },
      body: patch,
    }),
  );
}

export async function createDepartement(
  input: CreateDepartementInput,
  client: ApiClient = getApiClient(),
): Promise<Departement> {
  return unwrap(await client.POST('/api/v1/referentiels/departements', { body: input }));
}

export async function updateDepartement(
  id: string,
  patch: UpdateDepartementInput,
  client: ApiClient = getApiClient(),
): Promise<Departement> {
  return unwrap(
    await client.PATCH('/api/v1/referentiels/departements/{id}', {
      params: { path: { id } },
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
