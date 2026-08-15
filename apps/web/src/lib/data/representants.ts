import type { ApiClient, components, operations } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { flattenPage } from '@/lib/api/query-params';
import { EMPTY_REPRESENTANT_FILTERS, type RepresentantFilters } from '@/lib/representant-filters';
import type { Paginated, RepresentantRow, UpdateRepresentantInput } from '@/lib/types';

/**
 * Représentants : les personnes rencontrées sur le terrain, qui apportent les
 * prospects. `GET|POST /representants`, `GET|PATCH|DELETE /representants/{id}`.
 */

type RepresentantQuery = NonNullable<operations['listRepresentants']['parameters']['query']>;

export type CreateRepresentantInput = components['schemas']['CreateRepresentantDto'];
export type RepresentantLookup = components['schemas']['RepresentantLookupDto'];

/**
 * Bornes de journée explicitées, comme pour les prospects : sans heure,
 * `dateTo=2026-08-12` serait lu comme minuit pile et exclurait toute la
 * journée du 12. L'heure métier est `Africa/Dakar`, soit UTC+0 toute l'année :
 * `Z` est exact, sans conversion.
 */
const startOfDay = (isoDate: string): string => `${isoDate}T00:00:00.000Z`;
const endOfDay = (isoDate: string): string => `${isoDate}T23:59:59.999Z`;

/**
 * Filtre de l'écran → paramètres de requête du contrat.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * UN seul constructeur, pour le tableau ET pour l'export.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'export empruntait auparavant le sérialiseur d'URL du NAVIGATEUR
 * (`serializeRepresentantFilters`), qui écrit le vocabulaire de l'écran et non
 * celui de l'API. Deux défauts silencieux en découlaient, et tous deux
 * produisaient un classeur qui ne décrit PAS la population affichée :
 *
 *  1. `hasProspects` partait en `oui` / `non`. L'API attend un booléen et
 *     transforme toute chaîne non vide en `true` : demander « aucun prospect »
 *     exportait exactement l'inverse, sans le moindre message.
 *  2. Les dates partaient en `YYYY-MM-DD` brut, alors que le tableau borne la
 *     journée. L'API fait `lte: new Date(dateTo)`, soit minuit pile : le
 *     dernier jour de la période disparaissait du fichier.
 *
 * Le module promet « exactement ce que vous aviez sous les yeux » ; cette
 * promesse n'est tenable que si les deux chemins passent par la même fonction.
 * Le type nu (sans `& Record<string, unknown>`) est ce qui l'empêche de
 * diverger à nouveau.
 */
export function toRepresentantQuery(filters: RepresentantFilters): RepresentantQuery {
  const query: RepresentantQuery = {
    page: filters.page,
    pageSize: filters.pageSize,
  };

  const search = filters.search.trim();
  if (search !== '') query.search = search;
  if (filters.departementId !== null) query.departementId = filters.departementId;
  if (filters.iefId !== null) query.iefId = filters.iefId;
  if (filters.commercialId !== null) query.commercialId = filters.commercialId;
  if (filters.dateFrom !== null) query.dateFrom = startOfDay(filters.dateFrom);
  if (filters.dateTo !== null) query.dateTo = endOfDay(filters.dateTo);
  if (filters.hasProspects !== null) query.hasProspects = filters.hasProspects;
  if (filters.sortBy !== EMPTY_REPRESENTANT_FILTERS.sortBy) query.sortBy = filters.sortBy;
  /*
    `sortDir` dans l'URL, `sortOrder` sur le fil : la MÊME traduction que
    `toProspectQuery` et `toBankCaseQuery`.

    Cet écran écrivait `sortOrder` jusque dans la barre d'adresse, seul des
    trois. Deux mots pour un même critère, c'est deux façons d'écrire un lien
    partagé, et un « trier par date, croissant » qui se recopie d'un écran à
    l'autre sans marcher.
  */
  if (filters.sortDir !== EMPTY_REPRESENTANT_FILTERS.sortDir) {
    query.sortOrder = filters.sortDir;
  }

  return query;
}

export async function fetchRepresentants(
  filters: RepresentantFilters,
  client: ApiClient = getApiClient(),
): Promise<Paginated<RepresentantRow>> {
  return flattenPage(
    unwrap(
      await client.GET('/api/v1/representants', {
        params: { query: toRepresentantQuery(filters) },
      }),
    ),
  );
}

export async function fetchRepresentant(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<RepresentantRow> {
  return unwrap(await client.GET('/api/v1/representants/{id}', { params: { path: { id } } }));
}

/**
 * Création manuelle depuis le panel.
 *
 * `POST /representants` existait depuis le début et n'avait AUCUN appelant web :
 * une fiche ne pouvait naître que sur le mobile, une par une, en tournée. C'est
 * le bon défaut (le numéro se vérifie face à la personne), mais il n'y avait
 * aucune issue pour une fiche à corriger ou à créer depuis le siège.
 *
 * L'identifiant est laissé au SERVEUR : le champ `id` du contrat existe pour
 * que le mobile puisse référencer un représentant hors ligne avant toute
 * synchronisation. Le panel est en ligne par construction, et fabriquer un
 * UUID v7 côté navigateur n'apporterait qu'une source d'identifiants
 * supplémentaire.
 */
export async function createRepresentant(
  input: CreateRepresentantInput,
  client: ApiClient = getApiClient(),
): Promise<RepresentantRow> {
  return unwrap(await client.POST('/api/v1/representants', { body: input }));
}

/**
 * Recherche par téléphone AVANT saisie.
 *
 * Le numéro est la clé de déduplication de tout le module : deux fiches pour la
 * même personne cassent le rattachement des prospects déjà saisis, et cela ne
 * se répare pas en une manipulation. L'API répond même si la fiche appartient à
 * un autre commercial, en nommant son propriétaire : l'écran peut donc dire à
 * qui s'adresser plutôt que d'afficher un refus opaque.
 *
 * Ce contrôle ne REMPLACE pas celui du serveur (l'unicité est une contrainte
 * PostgreSQL) : il évite de découvrir le conflit après avoir tout rempli.
 */
export async function lookupRepresentantByPhone(
  phone: string,
  client: ApiClient = getApiClient(),
): Promise<RepresentantLookup> {
  return unwrap(await client.GET('/api/v1/representants/lookup', { params: { query: { phone } } }));
}

export async function updateRepresentant(
  id: string,
  patch: UpdateRepresentantInput,
  client: ApiClient = getApiClient(),
): Promise<RepresentantRow> {
  return unwrap(
    await client.PATCH('/api/v1/representants/{id}', { params: { path: { id } }, body: patch }),
  );
}

/**
 * Suppression logique. L'API répond 409 tant que des prospects sont rattachés :
 * l'écran doit donc proposer de les réaffecter d'abord, pas se contenter
 * d'afficher « échec ».
 */
export async function deleteRepresentant(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<void> {
  unwrap(await client.DELETE('/api/v1/representants/{id}', { params: { path: { id } } }));
}
