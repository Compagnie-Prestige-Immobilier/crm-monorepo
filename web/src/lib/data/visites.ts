import type { ApiClient, components, operations } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { flattenPage } from '@/lib/api/query-params';
import { readEnum, readIsoDate, readPositiveInt, readString } from '@/lib/search-params';
import type { Paginated, SortDirection } from '@/lib/types';

export type Visite = components['schemas']['Visite'];
export type VisiteRef = components['schemas']['VisiteRef'];
export type VisiteReferentielItem = components['schemas']['EntreeReferentielVisite'];
export type VisiteReferentiels = components['schemas']['ReferentielsVisiteOutputBody'];
export type CreateVisiteInput = components['schemas']['CreerVisiteInputBody'];
export type UpdateVisiteInput = components['schemas']['CorrigerVisiteInputBody'];
type VisitesQuery = NonNullable<operations['listVisites']['parameters']['query']>;

export const VISITE_SORT_FIELDS = [
  'visitedAt',
  'visitorName',
  'entreprise',
  'direction',
  'destinataire',
  'objet',
] as const satisfies readonly Exclude<VisitesQuery['sortBy'], undefined>[];

export type VisiteSortField = (typeof VISITE_SORT_FIELDS)[number];

/** Les intitulés du classeur Excel tenu depuis des années. On n'y touche pas. */
export const VISITE_COLONNES = {
  date: 'DATE VISITE',
  time: 'HEURE VISITE',
  visitorName: 'PRENOM ET NOMS',
  phone: 'TELEPHONES',
  entreprise: 'ENTREPRISE',
  direction: 'DIRECTION',
  destinataire: 'DESTINATAIRES',
  objet: 'OBJET VISITE',
  comment: 'COMMENTAIRES / NOTES',
} as const;

const VISITE_PAGE_SIZE = 100;

/** Le classeur, colonne à colonne, dans l'ordre où l'accueil le lit — et où il s'imprime. */
export const IMPRESSION_COLONNES = [
  'N° REGISTRE',
  VISITE_COLONNES.date,
  VISITE_COLONNES.time,
  VISITE_COLONNES.visitorName,
  VISITE_COLONNES.phone,
  VISITE_COLONNES.entreprise,
  VISITE_COLONNES.direction,
  VISITE_COLONNES.destinataire,
  VISITE_COLONNES.objet,
  VISITE_COLONNES.comment,
] as const;

export type ImpressionColonne = (typeof IMPRESSION_COLONNES)[number];

/** Sans elles, la feuille n'identifie plus ni le jour ni la personne : ce n'est plus un registre. */
export const IMPRESSION_COLONNES_VERROUILLEES: readonly ImpressionColonne[] = [
  VISITE_COLONNES.date,
  VISITE_COLONNES.visitorName,
];

export const IMPRESSION_COLONNES_PAR_DEFAUT: ReadonlySet<ImpressionColonne> = new Set(
  IMPRESSION_COLONNES,
);

export function impressionColonneVisible(
  colonne: ImpressionColonne,
  colonnesImprimees: ReadonlySet<ImpressionColonne>,
): boolean {
  return colonnesImprimees.has(colonne);
}

export function toggleImpressionColonne(
  colonnesImprimees: ReadonlySet<ImpressionColonne>,
  colonne: ImpressionColonne,
): ReadonlySet<ImpressionColonne> {
  if (IMPRESSION_COLONNES_VERROUILLEES.includes(colonne)) return colonnesImprimees;
  const next = new Set(colonnesImprimees);
  if (next.has(colonne)) next.delete(colonne);
  else next.add(colonne);
  return next;
}

/** `VisiteQueryDto.search` exige deux caractères ; en dessous l'API répond 400. */
const SEARCH_MIN_LENGTH = 2;

export interface VisiteFilters {
  search: string;
  entrepriseId: string | null;
  directionId: string | null;
  destinataireId: string | null;
  objetId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  toutePeriode: boolean;
  page: number;
  pageSize: number;
  sortBy: VisiteSortField;
  sortDir: SortDirection;
}

export const EMPTY_VISITE_FILTERS: VisiteFilters = {
  search: '',
  entrepriseId: null,
  directionId: null,
  destinataireId: null,
  objetId: null,
  dateFrom: null,
  dateTo: null,
  toutePeriode: false,
  page: 1,
  pageSize: VISITE_PAGE_SIZE,
  sortBy: 'visitedAt',
  sortDir: 'desc',
};

export function parseVisiteFilters(params: URLSearchParams): VisiteFilters {
  return {
    search: readString(params, 'search') ?? '',
    entrepriseId: readString(params, 'entrepriseId'),
    directionId: readString(params, 'directionId'),
    destinataireId: readString(params, 'destinataireId'),
    objetId: readString(params, 'objetId'),
    dateFrom: readIsoDate(params, 'dateFrom'),
    dateTo: readIsoDate(params, 'dateTo'),
    toutePeriode: readString(params, 'periode') === 'tout',
    page: readPositiveInt(params, 'page', 1),
    pageSize: VISITE_PAGE_SIZE,
    sortBy: readEnum(params, 'sortBy', VISITE_SORT_FIELDS) ?? EMPTY_VISITE_FILTERS.sortBy,
    sortDir: readString(params, 'sortDir') === 'asc' ? 'asc' : 'desc',
  };
}

export function serializeVisiteFilters(filters: VisiteFilters): URLSearchParams {
  const params = new URLSearchParams();
  const put = (key: string, value: string | null): void => {
    if (value !== null && value !== '') params.set(key, value);
  };

  put('search', filters.search.trim());
  put('entrepriseId', filters.entrepriseId);
  put('directionId', filters.directionId);
  put('destinataireId', filters.destinataireId);
  put('objetId', filters.objetId);
  put('dateFrom', filters.dateFrom);
  put('dateTo', filters.dateTo);
  if (filters.toutePeriode) params.set('periode', 'tout');
  if (filters.page !== 1) params.set('page', String(filters.page));
  if (filters.sortBy !== EMPTY_VISITE_FILTERS.sortBy) put('sortBy', filters.sortBy);
  if (filters.sortDir !== EMPTY_VISITE_FILTERS.sortDir) put('sortDir', filters.sortDir);

  return params;
}

export function visitesQueryKey(filters: VisiteFilters): readonly string[] {
  return ['visites', serializeVisiteFilters(filters).toString()];
}

export const VISITE_REFERENTIELS_QUERY_KEY = ['visites', 'referentiels'] as const;

export function countActiveVisiteFilters(filters: VisiteFilters): number {
  let count = 0;
  if (filters.search.trim() !== '') count += 1;
  if (filters.entrepriseId !== null) count += 1;
  if (filters.directionId !== null) count += 1;
  if (filters.destinataireId !== null) count += 1;
  if (filters.objetId !== null) count += 1;
  if (filters.dateFrom !== null || filters.dateTo !== null) count += 1;
  else if (filters.toutePeriode) count += 1;
  return count;
}

/** Sans date choisie ni registre entier demandé, le registre est celui du jour. */
export function visiteDateRange(
  filters: VisiteFilters,
  today: string,
): { dateFrom: string | null; dateTo: string | null } {
  if (filters.dateFrom !== null || filters.dateTo !== null) {
    return { dateFrom: filters.dateFrom, dateTo: filters.dateTo };
  }
  if (filters.toutePeriode) return { dateFrom: null, dateTo: null };
  return { dateFrom: today, dateTo: today };
}

function visitesQuery(filters: VisiteFilters, today: string): VisitesQuery {
  const range = visiteDateRange(filters, today);
  const query: VisitesQuery = {
    page: filters.page,
    pageSize: filters.pageSize,
    sortBy: filters.sortBy,
    sortOrder: filters.sortDir,
  };

  if (range.dateFrom !== null) query.from = range.dateFrom;
  if (range.dateTo !== null) query.to = range.dateTo;
  if (filters.entrepriseId !== null) query.entrepriseId = filters.entrepriseId;
  if (filters.directionId !== null) query.directionId = filters.directionId;
  if (filters.destinataireId !== null) query.destinataireId = filters.destinataireId;
  if (filters.objetId !== null) query.objetId = filters.objetId;

  const search = filters.search.trim();
  if (search.length >= SEARCH_MIN_LENGTH) query.search = search;

  return query;
}

/** Dakar est à UTC toute l'année : l'horloge du serveur et la sienne coïncident. */
export function dakarNow(at: Date = new Date()): { date: string; time: string } {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return {
    date: `${String(at.getUTCFullYear())}-${pad(at.getUTCMonth() + 1)}-${pad(at.getUTCDate())}`,
    time: `${pad(at.getUTCHours())}:${pad(at.getUTCMinutes())}`,
  };
}

/** La plus récente en haut : c'est l'ordre du classeur, et celui de la journée. */
export function orderVisites(items: readonly Visite[]): Visite[] {
  return [...items].sort((a, b) =>
    `${b.date} ${b.time ?? ''}`.localeCompare(`${a.date} ${a.time ?? ''}`),
  );
}

/**
 * Ce que la correction envoie : les seuls champs que la Directrice a touchés.
 * Renvoyer une valeur inchangée ferait rejeter la ligne dès qu'une entrée de
 * référentiel a été retirée depuis, alors qu'elle corrige un tout autre champ.
 */
export function visiteCorrection(before: Visite, after: CreateVisiteInput): UpdateVisiteInput {
  const patch: UpdateVisiteInput = {};
  const poser = <K extends keyof UpdateVisiteInput>(
    key: K,
    avant: () => UpdateVisiteInput[K],
    apres: () => UpdateVisiteInput[K],
  ): void => {
    const valeurAvant = avant();
    const valeurApres = apres();
    if (valeurAvant !== valeurApres) patch[key] = valeurApres;
  };

  poser(
    'time',
    () => before.time,
    () => after.time ?? null,
  );
  poser(
    'visitorName',
    () => before.visitorName,
    () => after.visitorName,
  );
  poser(
    'phone',
    () => before.phone ?? '',
    () => after.phone ?? '',
  );
  poser(
    'entrepriseId',
    () => before.entreprise.id,
    () => after.entrepriseId,
  );
  poser(
    'objetId',
    () => before.objet.id,
    () => after.objetId,
  );
  poser(
    'directionId',
    () => before.direction?.id ?? null,
    () => after.directionId ?? null,
  );
  poser(
    'destinataireId',
    () => before.destinataire?.id ?? null,
    () => after.destinataireId ?? null,
  );
  poser(
    'comment',
    () => before.comment ?? '',
    () => after.comment ?? '',
  );

  return patch;
}

export async function fetchVisiteReferentiels(
  client: ApiClient = getApiClient(),
): Promise<VisiteReferentiels> {
  return unwrap(await client.GET('/api/v1/visites/referentiels'));
}

export async function fetchVisites(
  filters: VisiteFilters,
  today: string,
  client: ApiClient = getApiClient(),
): Promise<Paginated<Visite>> {
  const query = visitesQuery(filters, today);
  return flattenPage(unwrap(await client.GET('/api/v1/visites', { params: { query } })));
}

export async function createVisite(
  input: CreateVisiteInput,
  client: ApiClient = getApiClient(),
): Promise<Visite> {
  return unwrap(await client.POST('/api/v1/visites', { body: input }));
}

export async function updateVisite(
  id: string,
  input: UpdateVisiteInput,
  client: ApiClient = getApiClient(),
): Promise<Visite> {
  return unwrap(
    await client.PATCH('/api/v1/visites/{id}', { params: { path: { id } }, body: input }),
  );
}
