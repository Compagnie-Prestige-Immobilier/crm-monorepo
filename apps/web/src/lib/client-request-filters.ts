import type { components } from '@crm/api-client';

import { readPositiveInt, readString, type RawSearchParams } from '@/lib/search-params';

/**
 * Filtre des demandes de création de client : traduction URL ⇄ objet, sur le
 * modèle de `lib/representant-filters.ts`.
 *
 * L'écran d'arbitrage se partage : « les demandes en attente de la CBAO » doit
 * être un lien qu'un administrateur colle à un collègue, pas un état perdu au
 * rechargement. Le statut vit donc dans l'URL comme les autres critères, et non
 * dans un `useState` d'onglet.
 *
 * Analyse TOLÉRANTE : une valeur inconnue est écartée plutôt que propagée vers
 * l'API. Une URL bricolée à la main ne doit pas produire un 400 sur un écran
 * que l'utilisateur n'a fait qu'ouvrir.
 */

export type ClientRequestStatus = components['schemas']['ClientRequestStatus'];

export const CLIENT_REQUEST_STATUSES: readonly ClientRequestStatus[] = [
  'PENDING',
  'APPROVED',
  'REJECTED',
];

export const CLIENT_REQUEST_STATUS_LABELS: Record<ClientRequestStatus, string> = {
  PENDING: 'En attente',
  APPROVED: 'Approuvée',
  REJECTED: 'Refusée',
};

export const CLIENT_REQUEST_PAGE_SIZE = 25;

export interface ClientRequestFilters {
  /** `null` : tous les statuts confondus. */
  status: ClientRequestStatus | null;
  search: string;
  banqueId: string | null;
  page: number;
  pageSize: number;
}

/**
 * Défaut : les demandes EN ATTENTE.
 *
 * L'écran existe pour arbitrer, pas pour consulter un historique. Ouvrir sur
 * « tous statuts » noierait les trois demandes à traiter au milieu de deux
 * cents demandes déjà tranchées, et c'est le tri manuel que ce module doit
 * éviter.
 */
export const DEFAULT_CLIENT_REQUEST_FILTERS: ClientRequestFilters = {
  status: 'PENDING',
  search: '',
  banqueId: null,
  page: 1,
  pageSize: CLIENT_REQUEST_PAGE_SIZE,
};

export type { RawSearchParams };

/**
 * `statut=tous` est une valeur EXPLICITE et non l'absence de paramètre : le
 * défaut de l'écran étant « en attente », il faut pouvoir demander l'ensemble
 * dans une URL, ce qu'une clé absente ne permettrait pas d'exprimer.
 */
export const ALL_STATUSES = 'tous';

export function parseClientRequestFilters(
  params: RawSearchParams | URLSearchParams,
): ClientRequestFilters {
  const status = readString(params, 'statut');

  return {
    status:
      status === ALL_STATUSES
        ? null
        : status !== null && (CLIENT_REQUEST_STATUSES as readonly string[]).includes(status)
          ? (status as ClientRequestStatus)
          : DEFAULT_CLIENT_REQUEST_FILTERS.status,
    search: readString(params, 'search') ?? '',
    banqueId: readString(params, 'banqueId'),
    page: readPositiveInt(params, 'page', 1),
    pageSize: CLIENT_REQUEST_PAGE_SIZE,
  };
}

/** Sérialisation canonique : défauts omis, ordre de clés fixe, donc clé de cache. */
export function serializeClientRequestFilters(filters: ClientRequestFilters): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.status === null) params.set('statut', ALL_STATUSES);
  else if (filters.status !== DEFAULT_CLIENT_REQUEST_FILTERS.status) {
    params.set('statut', filters.status);
  }

  const search = filters.search.trim();
  if (search !== '') params.set('search', search);
  if (filters.banqueId !== null) params.set('banqueId', filters.banqueId);
  if (filters.page !== 1) params.set('page', String(filters.page));

  return params;
}

export function clientRequestFiltersQueryKey(filters: ClientRequestFilters): string {
  return serializeClientRequestFilters(filters).toString();
}

export function countActiveClientRequestFilters(filters: ClientRequestFilters): number {
  let count = 0;
  if (filters.status !== DEFAULT_CLIENT_REQUEST_FILTERS.status) count += 1;
  if (filters.search.trim() !== '') count += 1;
  if (filters.banqueId !== null) count += 1;
  return count;
}
