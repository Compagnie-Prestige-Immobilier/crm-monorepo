import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { fetchMesAttributions } from '@/lib/data/attributions';
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
type Projet = components['schemas']['Projet'];

const GRAND_PUBLIC: Projet = 'GRAND_PUBLIC';

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

/**
 * D'où la fiche vient pour CELUI QUI LA LIT : de sa propre saisie, ou d'une
 * campagne qui la lui a confiée. `TOUS` ne distingue pas.
 */
export const ORIGINES_FICHE = ['TOUS', 'MOI', 'CAMPAGNE'] as const;

export type OrigineFiche = (typeof ORIGINES_FICHE)[number];

export const ORIGINE_FICHE_LABELS: Record<OrigineFiche, string> = {
  TOUS: 'Toutes',
  MOI: 'Ajoutés par moi',
  CAMPAGNE: 'Issus d’une campagne',
};

export interface GrandPublicFilters {
  search: string;
  origine: OrigineFiche;
  type: ProspectType | null;
  canalProvenanceId: string | null;
  representantId: string | null;
  departementId: string | null;
  banqueId: string | null;
  syndicatId: string | null;
  statut: ProspectStatut | null;
  dateFrom: string | null;
  dateTo: string | null;
  page: number;
  pageSize: number;
}

export const EMPTY_GRAND_PUBLIC_FILTERS: GrandPublicFilters = {
  search: '',
  origine: 'TOUS',
  type: null,
  canalProvenanceId: null,
  representantId: null,
  departementId: null,
  banqueId: null,
  syndicatId: null,
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
    origine: readEnum<OrigineFiche>(params, 'origine', ORIGINES_FICHE) ?? 'TOUS',
    type: readEnum<ProspectType>(params, 'type', PROSPECT_TYPES),
    canalProvenanceId: readString(params, 'canalProvenanceId'),
    representantId: readString(params, 'representantId'),
    departementId: readString(params, 'departementId'),
    banqueId: readString(params, 'banqueId'),
    syndicatId: readString(params, 'syndicatId'),
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
  if (filters.origine !== 'TOUS') put('origine', filters.origine);
  put('type', filters.type);
  put('canalProvenanceId', filters.canalProvenanceId);
  put('representantId', filters.representantId);
  put('departementId', filters.departementId);
  put('banqueId', filters.banqueId);
  put('syndicatId', filters.syndicatId);
  put('statut', filters.statut);
  put('dateFrom', filters.dateFrom);
  put('dateTo', filters.dateTo);
  if (filters.page !== 1) put('page', String(filters.page));
  if (filters.pageSize !== DEFAULT_PAGE_SIZE) put('pageSize', String(filters.pageSize));

  return params;
}

function grandPublicFiltersKey(filters: GrandPublicFilters): string {
  return serializeGrandPublicFilters(filters).toString();
}

export function countGrandPublicFilters(filters: GrandPublicFilters): number {
  return [
    filters.search.trim() !== '',
    filters.origine !== 'TOUS',
    filters.type !== null,
    filters.canalProvenanceId !== null,
    filters.representantId !== null,
    filters.departementId !== null,
    filters.banqueId !== null,
    filters.syndicatId !== null,
    filters.statut !== null,
    filters.dateFrom !== null || filters.dateTo !== null,
  ].filter(Boolean).length;
}

/**
 * `projet` est posé ICI et non par l'appelant : oublié, la liste rendrait aussi
 * les fiches CHUES. Les bornes de date passent par `toFilterQuery`, seul endroit
 * qui sait que la journée métier se ferme à 23:59:59.999 heure de Dakar.
 */
function toGrandPublicQuery(filters: GrandPublicFilters, viewerId: string): ProspectQuery {
  const base = toFilterQuery({
    ...EMPTY_FILTERS,
    search: filters.search,
    statut: filters.statut,
    representantId: filters.representantId,
    departementId: filters.departementId,
    banqueId: filters.banqueId,
    syndicatId: filters.syndicatId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
  });

  return {
    ...base,
    projet: GRAND_PUBLIC,
    ...(filters.type === null ? {} : { type: filters.type }),
    ...(filters.canalProvenanceId === null ? {} : { canalProvenanceId: filters.canalProvenanceId }),
    ...(filters.origine === 'MOI' ? { commercialId: viewerId } : {}),
    page: filters.page,
    pageSize: filters.pageSize,
    sortBy: 'clientCreatedAt',
    sortOrder: 'desc',
  };
}

/**
 * Le balayage que « Issus d'une campagne » demande. L'API ne sait pas filtrer
 * sur l'attribution : on lit le portefeuille par tranches et on garde les
 * fiches attribuées. La borne évite qu'un gros portefeuille tienne l'écran.
 */
const CAMPAGNE_TRANCHE = 200;
const CAMPAGNE_TRANCHES_MAX = 10;

async function fetchProspectsDeCampagne(
  filters: GrandPublicFilters,
  client: ApiClient,
): Promise<Paginated<ProspectRow>> {
  const { prospectIds, tout } = await fetchMesAttributions(client);
  // Rien n'est confié à l'encadrement : le critère ne le concerne pas, et lui
  // rendre une liste vide lui ferait croire que ses campagnes sont vides.
  if (tout) return fetchGrandPublicProspects({ ...filters, origine: 'TOUS' }, '', client);
  const attribues = new Set(prospectIds);
  const retenus: ProspectRow[] = [];

  for (let tranche = 1; tranche <= CAMPAGNE_TRANCHES_MAX; tranche += 1) {
    const query = toGrandPublicQuery({ ...filters, origine: 'TOUS' }, '');
    const payload = unwrap(
      await client.GET('/api/v1/prospects', {
        params: {
          query: { ...query, mesFiches: true, page: tranche, pageSize: CAMPAGNE_TRANCHE },
        },
      }),
    );
    retenus.push(...payload.items.filter((prospect) => attribues.has(prospect.id)));
    if (tranche >= payload.meta.pageCount) break;
  }

  const debut = (filters.page - 1) * filters.pageSize;
  return {
    items: retenus.slice(debut, debut + filters.pageSize),
    total: retenus.length,
    page: filters.page,
    pageSize: filters.pageSize,
    pageCount: Math.max(1, Math.ceil(retenus.length / filters.pageSize)),
  };
}

export async function fetchGrandPublicProspects(
  filters: GrandPublicFilters,
  viewerId: string,
  client: ApiClient = getApiClient(),
): Promise<Paginated<ProspectRow>> {
  if (filters.origine === 'CAMPAGNE') return fetchProspectsDeCampagne(filters, client);
  const payload = unwrap(
    await client.GET('/api/v1/prospects', {
      params: { query: toGrandPublicQuery(filters, viewerId) },
    }),
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
