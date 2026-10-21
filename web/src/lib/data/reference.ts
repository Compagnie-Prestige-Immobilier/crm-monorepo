import type { ApiClient } from '@crm/api-client';
import { ApiError, unwrap } from '@crm/api-client/query';
import { toast } from 'sonner';

import { getApiClient } from '@/lib/api/browser';
import { formatNumber } from '@/lib/format';
import { peut, type SessionUser } from '@/lib/types';
import type {
  Banque,
  Departement,
  Employeur,
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
 * Un refus de rôle rend donc une liste vide, c'est ce que ce rôle est censé
 * voir. Toute autre panne continue de remonter.
 */
interface CompteFiltre {
  id: string;
  fullName: string;
  role: string;
  isActive: boolean;
}

/** Une fiche n'est pas creee que par un teleconseiller : le filtre les porte tous. */
function optionCompte(compte: CompteFiltre): FilterOption {
  return {
    value: compte.id,
    label: compte.fullName,
    hint: compte.isActive ? undefined : 'Compte désactivé',
  };
}

function comptesFacultatifs(result: {
  data?: { items: CompteFiltre[]; meta: { total: number } };
  error?: unknown;
  response: Response;
}): CompteFiltre[] {
  try {
    const page = unwrap(result);
    if (page.meta.total > page.items.length) {
      toast.warning(
        `Seuls les ${formatNumber(page.items.length)} premiers comptes sont proposés dans les filtres. Signalez-le à l’administrateur.`,
        { id: 'plafond-comptes' },
      );
    }
    return page.items;
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return [];
    throw error;
  }
}

/** Sans la session, tout est demandé : un refus 403 rend alors une liste vide. */
export async function fetchReferenceData(
  session?: Pick<SessionUser, 'permissions'>,
  client: ApiClient = getApiClient(),
): Promise<ReferenceData> {
  const lit = (permission: Parameters<typeof peut>[1]): boolean =>
    session === undefined || peut(session, permission);
  const [bundle, iefs, users] = await Promise.all([
    client.GET('/api/v1/referentiels', { params: { query: { activeOnly: false } } }),
    client.GET('/api/v1/referentiels/{kind}', {
      params: { path: { kind: 'iefs' }, query: { activeOnly: false } },
    }),
    lit('comptes.lister')
      ? client.GET('/api/v1/users', { params: { query: { pageSize: 200 } } })
      : null,
  ]);

  const referentiels = unwrap(bundle);
  const comptes = users === null ? [] : comptesFacultatifs(users);

  return {
    regions: referentiels.regions,
    departements: referentiels.departements,
    iefs: unwrap(iefs),
    banques: referentiels.banques,
    syndicats: referentiels.syndicats,
    professions: referentiels.professions,
    incomeBands: referentiels.incomeBands,
    offers: referentiels.offers,
    employeurs: referentiels.employeurs,
    pays: referentiels.pays,
    commerciaux: comptes.filter((compte) => compte.role === 'COMMERCIAL').map(optionCompte),
    utilisateurs: comptes.map(optionCompte),
  };
}

export async function fetchIefs(
  departementId?: string,
  client: ApiClient = getApiClient(),
): Promise<Ief[]> {
  return unwrap(
    await client.GET('/api/v1/referentiels/{kind}', {
      params: {
        path: { kind: 'iefs' },
        query: { activeOnly: false, ...(departementId === undefined ? {} : { departementId }) },
      },
    }),
  );
}

export async function fetchDepartements(
  client: ApiClient = getApiClient(),
): Promise<Departement[]> {
  return unwrap(
    await client.GET('/api/v1/referentiels/{kind}', {
      params: { path: { kind: 'departements' }, query: { activeOnly: false } },
    }),
  );
}

export async function fetchBanques(client: ApiClient = getApiClient()): Promise<Banque[]> {
  return unwrap(
    await client.GET('/api/v1/referentiels/{kind}', {
      params: { path: { kind: 'banques' }, query: { activeOnly: false } },
    }),
  );
}

export async function fetchSyndicats(client: ApiClient = getApiClient()): Promise<Syndicat[]> {
  return unwrap(
    await client.GET('/api/v1/referentiels/{kind}', {
      params: { path: { kind: 'syndicats' }, query: { activeOnly: false } },
    }),
  );
}

export async function fetchRegions(client: ApiClient = getApiClient()): Promise<Region[]> {
  return unwrap(
    await client.GET('/api/v1/referentiels/{kind}', { params: { path: { kind: 'regions' } } }),
  );
}

export async function fetchProfessions(client: ApiClient = getApiClient()): Promise<Profession[]> {
  return unwrap(
    await client.GET('/api/v1/referentiels/{kind}', {
      params: { path: { kind: 'professions' }, query: { activeOnly: false } },
    }),
  );
}

export async function fetchReferentielComplet(
  kind: 'points-rencontre',
  client: ApiClient = getApiClient(),
): Promise<Profession[]> {
  return unwrap(
    await client.GET('/api/v1/referentiels/{kind}', {
      params: { path: { kind }, query: { activeOnly: false } },
    }),
  );
}

export async function fetchIncomeBands(client: ApiClient = getApiClient()): Promise<IncomeBand[]> {
  return unwrap(
    await client.GET('/api/v1/referentiels/{kind}', {
      params: { path: { kind: 'tranches-revenu' }, query: { activeOnly: false } },
    }),
  );
}

export async function fetchEmployeurs(client: ApiClient = getApiClient()): Promise<Employeur[]> {
  return unwrap(
    await client.GET('/api/v1/referentiels/{kind}', {
      params: { path: { kind: 'employeurs' }, query: { activeOnly: false } },
    }),
  );
}

export async function fetchOffers(client: ApiClient = getApiClient()): Promise<Offer[]> {
  return unwrap(
    await client.GET('/api/v1/referentiels/{kind}', {
      params: { path: { kind: 'offres' }, query: { activeOnly: false } },
    }),
  );
}
