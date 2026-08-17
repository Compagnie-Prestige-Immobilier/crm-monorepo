import type { ApiClient } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import type {
  Banque,
  Departement,
  FilterOption,
  Ief,
  ReferenceData,
  Region,
  Syndicat,
} from '@/lib/types';

export async function fetchReferenceData(
  client: ApiClient = getApiClient(),
): Promise<ReferenceData> {
  const [bundle, iefs, users, representants, campaigns] = await Promise.all([
    client.GET('/api/v1/referentiels', { params: { query: { activeOnly: false } } }),
    client.GET('/api/v1/referentiels/iefs', { params: { query: { activeOnly: false } } }),
    client.GET('/api/v1/users', { params: { query: { role: 'COMMERCIAL', pageSize: 200 } } }),
    client.GET('/api/v1/representants', { params: { query: { pageSize: 200 } } }),
    client.GET('/api/v1/phase2/campaigns', { params: { query: { pageSize: 100 } } }),
  ]);

  const referentiels = unwrap(bundle);

  return {
    regions: referentiels.regions,
    departements: referentiels.departements,
    iefs: unwrap(iefs),
    banques: referentiels.banques,
    syndicats: referentiels.syndicats,
    commerciaux: unwrap(users).items.map((user): FilterOption => ({
      value: user.id,
      label: user.fullName,
      hint: user.isActive ? (user.departementName ?? undefined) : 'Compte désactivé',
    })),
    representants: unwrap(representants).items.map((representant): FilterOption => ({
      value: representant.id,
      label: representant.fullName,
      hint: representant.departementName,
    })),
    campagnes: unwrap(campaigns).items.map((campaign): FilterOption => ({
      value: campaign.id,
      label: campaign.name,
      hint: `${campaign.scope} · ${campaign.status === 'ACTIVE' ? 'en cours' : 'clôturée'}`,
    })),
  };
}

export async function fetchIefs(
  departementId?: string,
  client: ApiClient = getApiClient(),
): Promise<Ief[]> {
  return unwrap(
    await client.GET('/api/v1/referentiels/iefs', {
      params: {
        query: { activeOnly: false, ...(departementId === undefined ? {} : { departementId }) },
      },
    }),
  );
}

export async function fetchDepartements(
  client: ApiClient = getApiClient(),
): Promise<Departement[]> {
  return unwrap(
    await client.GET('/api/v1/referentiels/departements', {
      params: { query: { activeOnly: false } },
    }),
  );
}

export async function fetchBanques(client: ApiClient = getApiClient()): Promise<Banque[]> {
  return unwrap(
    await client.GET('/api/v1/referentiels/banques', { params: { query: { activeOnly: false } } }),
  );
}

export async function fetchSyndicats(client: ApiClient = getApiClient()): Promise<Syndicat[]> {
  return unwrap(
    await client.GET('/api/v1/referentiels/syndicats', {
      params: { query: { activeOnly: false } },
    }),
  );
}

export async function fetchRegions(client: ApiClient = getApiClient()): Promise<Region[]> {
  return unwrap(await client.GET('/api/v1/referentiels/regions'));
}
