import type { ApiClient } from '@crm/api-client';
import { ApiError, unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { formatPhone } from '@/lib/format';
import type {
  Banque,
  Departement,
  FilterOption,
  Ief,
  IncomeBand,
  Offer,
  Profession,
  ReferenceData,
  Region,
  Syndicat,
} from '@/lib/types';

/**
 * Trois des cinq appels sont réservés à des rôles que le paquet ne connaît pas.
 * Passés par `unwrap`, leur 403 faisait rejeter TOUTE la fonction : un
 * COMMERCIAL n'avait alors ni banque ni syndicat dans ses listes déroulantes, en
 * permanence et sans un message, et enregistrait des fiches sans segment.
 *
 * Un refus de rôle rend donc une liste vide — c'est ce que ce rôle est censé
 * voir. Toute autre panne continue de remonter.
 */
function listeFacultative<TItem>(
  result: { data?: { items: TItem[] }; error?: unknown; response: Response },
  map: (item: TItem) => FilterOption,
): FilterOption[] {
  try {
    return unwrap(result).items.map(map);
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return [];
    throw error;
  }
}

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
    professions: referentiels.professions,
    incomeBands: referentiels.incomeBands,
    offers: referentiels.offers,
    commerciaux: listeFacultative(users, (user) => ({
      value: user.id,
      label: user.fullName,
      hint: user.isActive ? (user.departementName ?? undefined) : 'Compte désactivé',
    })),
    representants: listeFacultative(representants, (representant) => ({
      value: representant.id,
      label: `${representant.fullName} - ${formatPhone(representant.phoneE164)}`,
      hint: representant.departementName,
    })),
    campagnes: listeFacultative(campaigns, (campaign) => ({
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

export async function fetchProfessions(client: ApiClient = getApiClient()): Promise<Profession[]> {
  return unwrap(
    await client.GET('/api/v1/referentiels/professions', {
      params: { query: { activeOnly: false } },
    }),
  );
}

export async function fetchIncomeBands(client: ApiClient = getApiClient()): Promise<IncomeBand[]> {
  return unwrap(
    await client.GET('/api/v1/referentiels/tranches-revenu', {
      params: { query: { activeOnly: false } },
    }),
  );
}

export async function fetchOffers(client: ApiClient = getApiClient()): Promise<Offer[]> {
  return unwrap(
    await client.GET('/api/v1/referentiels/offres', {
      params: { query: { activeOnly: false } },
    }),
  );
}
