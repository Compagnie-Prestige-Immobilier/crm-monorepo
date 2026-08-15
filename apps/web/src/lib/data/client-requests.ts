import type { ApiClient, components, operations } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import type { ClientRequestFilters } from '@/lib/client-request-filters';

/**
 * Demandes de création de client, déposées par les banques et arbitrées par
 * l'administrateur.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Ce module existe pour sortir d'une impasse, pas pour ajouter un écran.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un agent BANQUE_FINANCE qui ouvrait un dossier pour un client absent de la
 * base lisait « Aucun client ne correspond. » et n'avait AUCUNE issue : le rôle
 * n'a pas le droit de créer un prospect, et rien ne remontait au siège. Le
 * dossier ne se faisait pas, ou se faisait sur un homonyme.
 *
 * La demande est donc tracée, arbitrée, et l'approbation crée le prospect avec
 * sa provenance (`origin=BANQUE`, libellé = nom de la banque demandeuse) : on
 * peut ensuite mesurer ce qui entre hors base, ce qui était invisible.
 */

type Schemas = components['schemas'];

export type ClientRequest = Schemas['ClientRequestDto'];
export type ClientRequestList = Schemas['ClientRequestListDto'];
export type CreateClientRequestInput = Schemas['CreateClientRequestDto'];
export type ApproveClientRequestInput = Schemas['ApproveClientRequestDto'];

export async function fetchClientRequests(
  filters: ClientRequestFilters,
  client: ApiClient = getApiClient(),
): Promise<ClientRequestList> {
  // `exactOptionalPropertyTypes` : une clé posée à `undefined` n'est pas une
  // clé absente, et `openapi-fetch` la sérialiserait en `status=undefined`.
  const query: NonNullable<operations['listClientRequests']['parameters']['query']> = {
    page: filters.page,
    pageSize: filters.pageSize,
  };
  if (filters.status !== null) query.status = filters.status;
  const search = filters.search.trim();
  if (search !== '') query.search = search;
  if (filters.banqueId !== null) query.banqueId = filters.banqueId;

  return unwrap(await client.GET('/api/v1/client-requests', { params: { query } }));
}

/**
 * Dépôt d'une demande, côté banque.
 *
 * Le téléphone part en SAISIE LIBRE : c'est le serveur qui normalise en E.164,
 * et lui seul peut le faire de la même façon que la recherche de doublon. Le
 * normaliser ici en produirait une seconde version, et deux normalisations
 * divergentes fabriquent exactement les doublons que ce contrôle évite.
 */
export async function createClientRequest(
  input: CreateClientRequestInput,
  client: ApiClient = getApiClient(),
): Promise<ClientRequest> {
  return unwrap(await client.POST('/api/v1/client-requests', { body: input }));
}

export async function approveClientRequest(
  id: string,
  input: ApproveClientRequestInput,
  client: ApiClient = getApiClient(),
): Promise<ClientRequest> {
  return unwrap(
    await client.POST('/api/v1/client-requests/{id}/approve', {
      params: { path: { id } },
      body: input,
    }),
  );
}

/**
 * Refus. Le motif est OBLIGATOIRE côté API, et c'est le point du geste : un
 * refus muet renverrait l'agent à l'impasse de départ, sans savoir s'il doit
 * corriger le numéro, chercher un homonyme ou renoncer.
 */
export async function rejectClientRequest(
  id: string,
  reason: string,
  client: ApiClient = getApiClient(),
): Promise<ClientRequest> {
  return unwrap(
    await client.POST('/api/v1/client-requests/{id}/reject', {
      params: { path: { id } },
      body: { reason },
    }),
  );
}

// ─── Provenance ─────────────────────────────────────────────────────────────

/**
 * Libellé de provenance porté par le prospect issu d'une approbation.
 *
 * Il est composé ICI et pas seulement affiché tel quel, parce que la provenance
 * se lit en deux temps : d'où vient la fiche (`BANQUE`) et laquelle
 * (`originLabel`). Les deux séparément ne disent rien ; ensemble, ils
 * expliquent pourquoi ce prospect n'a pas de représentant de terrain.
 */
export function originLabelFor(origin: string | null, originLabel: string | null): string {
  if (origin === null) return 'Tournée terrain';
  if (origin === 'BANQUE') {
    return originLabel === null ? 'Demande d’une banque' : `Demande de ${originLabel}`;
  }
  return originLabel ?? origin;
}
