import type { ApiClient } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import type {
  Banque,
  Departement,
  FilterOption,
  ReferenceData,
  Region,
  Syndicat,
} from '@/lib/types';

/**
 * Référentiels — tout ce qui alimente les listes déroulantes de filtre.
 *
 * `activeOnly: false` partout, et c'est délibéré : un prospect saisi en mars
 * référence peut-être une banque retirée depuis. Si le combobox ne proposait
 * que les référentiels actifs, ce prospect deviendrait infiltrable — on ne
 * pourrait plus retrouver ses lignes pour les corriger. Les écrans marquent la
 * valeur « (retiré) » plutôt que de la cacher.
 */

export async function fetchReferenceData(
  client: ApiClient = getApiClient(),
): Promise<ReferenceData> {
  const [bundle, users, representants, campaigns] = await Promise.all([
    client.GET('/api/v1/referentiels', { params: { query: { activeOnly: false } } }),
    // 200 : au-delà, l'API plafonne. CPI compte une dizaine de commerciaux ;
    // une pagination de la liste de filtre serait de la complexité gratuite.
    client.GET('/api/v1/users', { params: { query: { role: 'COMMERCIAL', pageSize: 200 } } }),
    client.GET('/api/v1/representants', { params: { query: { pageSize: 200 } } }),
    /**
     * Campagnes d'appels : elles alimentent le filtre « Campagne » du tableau
     * des prospects. Rangées dans le MÊME lot que les autres référentiels
     * plutôt que dans une requête à part — la barre de filtre serait sinon
     * capable d'afficher ses six listes déroulantes pendant que la septième
     * charge encore, et un utilisateur filtrerait sur un écran à moitié prêt.
     */
    client.GET('/api/v1/phase2/campaigns', { params: { query: { pageSize: 100 } } }),
  ]);

  const referentiels = unwrap(bundle);

  return {
    regions: referentiels.regions,
    departements: referentiels.departements,
    banques: referentiels.banques,
    syndicats: referentiels.syndicats,
    commerciaux: unwrap(users).items.map((user): FilterOption => ({
      value: user.id,
      label: user.fullName,
      // Un compte désactivé garde ses prospects : il reste filtrable, mais
      // l'état doit être visible pour qu'on ne le croie pas encore en poste.
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
      // Le périmètre distingue deux campagnes du même mois ; le statut évite
      // de croire encore active une campagne clôturée la semaine dernière.
      hint: `${campaign.scope} · ${campaign.status === 'ACTIVE' ? 'en cours' : 'clôturée'}`,
    })),
  };
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
