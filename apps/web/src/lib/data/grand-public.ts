import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { flattenPage, toFilterQuery, type ProspectQuery } from '@/lib/api/query-params';
import { createProspect, type CreateProspectInput } from '@/lib/data/prospects';
import { DEFAULT_PAGE_SIZE, EMPTY_FILTERS, PAGE_SIZE_OPTIONS } from '@/lib/filters';
import {
  readEnum,
  readIsoDate,
  readPositiveInt,
  readString,
  type RawSearchParams,
} from '@/lib/search-params';
import {
  PROSPECT_STATUTS,
  type Paginated,
  type ProspectRow,
  type ProspectStatut,
} from '@/lib/types';

export type CanalProvenance = components['schemas']['CanalProvenanceDto'];
export type ProspectType = components['schemas']['ProspectType'];
export type Projet = components['schemas']['Projet'];

export const GRAND_PUBLIC: Projet = 'GRAND_PUBLIC';

export const PROSPECT_TYPES = [
  'FONCTIONNAIRE',
  'SECTEUR_PRIVE',
  'INFORMEL',
  'DIASPORA',
] as const satisfies readonly ProspectType[];

export const PROSPECT_TYPE_LABELS: Record<ProspectType, string> = {
  FONCTIONNAIRE: 'Fonctionnaire',
  SECTEUR_PRIVE: 'Secteur privé',
  INFORMEL: 'Informel',
  DIASPORA: 'Diaspora',
};

/** Les durées que le métier pratique. Un choix fermé plutôt qu'une frappe libre. */
export const DUREES_MOIS = [
  6, 12, 18, 24, 36, 48, 60, 72, 84, 96, 120, 144, 180, 240, 300,
] as const;

export function formatDureeMois(mois: number): string {
  if (mois % 12 !== 0) return `${String(mois)} mois`;
  const ans = mois / 12;
  return `${String(ans)} an${ans > 1 ? 's' : ''} (${String(mois)} mois)`;
}

export interface GrandPublicFilters {
  search: string;
  type: ProspectType | null;
  canalProvenanceId: string | null;
  statut: ProspectStatut | null;
  dateFrom: string | null;
  dateTo: string | null;
  page: number;
  pageSize: number;
}

export const EMPTY_GRAND_PUBLIC_FILTERS: GrandPublicFilters = {
  search: '',
  type: null,
  canalProvenanceId: null,
  statut: null,
  dateFrom: null,
  dateTo: null,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

export function parseGrandPublicFilters(
  params: RawSearchParams | URLSearchParams,
): GrandPublicFilters {
  const pageSize = readPositiveInt(params, 'pageSize', DEFAULT_PAGE_SIZE);
  return {
    search: readString(params, 'search') ?? '',
    type: readEnum<ProspectType>(params, 'type', PROSPECT_TYPES),
    canalProvenanceId: readString(params, 'canalProvenanceId'),
    statut: readEnum<ProspectStatut>(params, 'statut', PROSPECT_STATUTS),
    dateFrom: readIsoDate(params, 'dateFrom'),
    dateTo: readIsoDate(params, 'dateTo'),
    page: readPositiveInt(params, 'page', 1),
    pageSize: (PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSize)
      ? pageSize
      : DEFAULT_PAGE_SIZE,
  };
}

export function serializeGrandPublicFilters(filters: GrandPublicFilters): URLSearchParams {
  const params = new URLSearchParams();
  const put = (key: string, value: string | null): void => {
    if (value !== null && value !== '') params.set(key, value);
  };

  put('search', filters.search.trim());
  put('type', filters.type);
  put('canalProvenanceId', filters.canalProvenanceId);
  put('statut', filters.statut);
  put('dateFrom', filters.dateFrom);
  put('dateTo', filters.dateTo);
  if (filters.page !== 1) put('page', String(filters.page));
  if (filters.pageSize !== DEFAULT_PAGE_SIZE) put('pageSize', String(filters.pageSize));

  return params;
}

export function grandPublicFiltersKey(filters: GrandPublicFilters): string {
  return serializeGrandPublicFilters(filters).toString();
}

export function countGrandPublicFilters(filters: GrandPublicFilters): number {
  let count = 0;
  if (filters.search.trim() !== '') count += 1;
  if (filters.type !== null) count += 1;
  if (filters.canalProvenanceId !== null) count += 1;
  if (filters.statut !== null) count += 1;
  if (filters.dateFrom !== null || filters.dateTo !== null) count += 1;
  return count;
}

/**
 * `projet` est posé ICI et non par l'appelant : oublié, la liste rendrait aussi
 * les fiches CHUES. Les bornes de date passent par `toFilterQuery`, seul endroit
 * qui sait que la journée métier se ferme à 23:59:59.999 heure de Dakar.
 */
export function toGrandPublicQuery(filters: GrandPublicFilters): ProspectQuery {
  const base = toFilterQuery({
    ...EMPTY_FILTERS,
    search: filters.search,
    statut: filters.statut,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });

  return {
    ...base,
    projet: GRAND_PUBLIC,
    ...(filters.type === null ? {} : { type: filters.type }),
    ...(filters.canalProvenanceId === null ? {} : { canalProvenanceId: filters.canalProvenanceId }),
    page: filters.page,
    pageSize: filters.pageSize,
    sortBy: 'clientCreatedAt',
    sortOrder: 'desc',
  };
}

export async function fetchGrandPublicProspects(
  filters: GrandPublicFilters,
  client: ApiClient = getApiClient(),
): Promise<Paginated<ProspectRow>> {
  const payload = unwrap(
    await client.GET('/api/v1/prospects', { params: { query: toGrandPublicQuery(filters) } }),
  );
  return flattenPage(payload);
}

export async function fetchCanauxProvenance(
  client: ApiClient = getApiClient(),
): Promise<CanalProvenance[]> {
  return unwrap(
    await client.GET('/api/v1/referentiels/canaux-provenance', {
      params: { query: { activeOnly: false } },
    }),
  );
}

/** Le contrat de création, moins le projet : il est posé ici et nulle part ailleurs. */
export type GrandPublicProspectInput = Omit<CreateProspectInput, 'projet'>;

export async function createGrandPublicProspect(
  input: GrandPublicProspectInput,
  client: ApiClient = getApiClient(),
): Promise<ProspectRow> {
  return createProspect({ ...input, projet: GRAND_PUBLIC }, client);
}

export async function updateGrandPublicConsent(
  id: string,
  consent: components['schemas']['GrandPublicConsent'],
  client: ApiClient = getApiClient(),
): Promise<ProspectRow> {
  return unwrap(
    await client.PATCH('/api/v1/prospects/{id}/parcours/grand-public/consentement', {
      params: { path: { id } },
      body: { consent },
    }),
  );
}

export async function confirmGrandPublicConversion(
  id: string,
  body: components['schemas']['ConfirmGrandPublicConversionDto'],
  client: ApiClient = getApiClient(),
): Promise<ProspectRow> {
  return unwrap(
    await client.POST('/api/v1/prospects/{id}/parcours/grand-public/conversion', {
      params: { path: { id } },
      body,
    }),
  );
}

/**
 * Sous la racine `prospects` : une création côté CHUES et une création ici
 * touchent la même ressource, et une seule invalidation doit rafraîchir les deux.
 */
export const grandPublicKeys = {
  prospects: (filters: GrandPublicFilters) =>
    ['prospects', 'grand-public', grandPublicFiltersKey(filters)] as const,
  canaux: ['referentiels', 'canaux-provenance'] as const,
};
