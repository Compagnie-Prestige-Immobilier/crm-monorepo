import {
  BDD_SEGMENTS,
  ENROLLMENT_METHODS,
  PHASE2_STATUSES,
  PROSPECT_SORT_FIELDS,
  PROSPECT_STATUTS,
  type BddSegment,
  type EnrollmentMethod,
  type Phase2Status,
  type ProspectFilters,
  type ProspectSortField,
  type ProspectStatut,
  type SortDirection,
} from '@/lib/types';

/**
 * Traduction URL ⇄ filtre. L'URL est l'état ; il n'y a pas de copie dans un
 * store React. Un filtre appliqué est donc partageable, rechargeable et
 * navigable au bouton « précédent » sans travail supplémentaire.
 */

export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export const EMPTY_FILTERS: ProspectFilters = {
  search: '',
  commercialId: null,
  representantId: null,
  departementId: null,
  banqueId: null,
  syndicatId: null,
  statut: null,
  segment: null,
  phase2Status: null,
  enrollmentMethod: null,
  campaignId: null,
  enrollmentCapturedById: null,
  dateFrom: null,
  dateTo: null,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  sortBy: 'clientCreatedAt',
  sortDir: 'desc',
};

/** Ce que Next passe à une page serveur, et ce que `URLSearchParams` sait lire. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

function readOne(params: RawSearchParams | URLSearchParams, key: string): string | null {
  if (params instanceof URLSearchParams) return params.get(key);
  const raw = params[key];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

function readNullableString(params: RawSearchParams | URLSearchParams, key: string): string | null {
  const value = readOne(params, key);
  if (value === null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function readPositiveInt(
  params: RawSearchParams | URLSearchParams,
  key: string,
  fallback: number,
): number {
  const value = readNullableString(params, key);
  if (value === null) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** `YYYY-MM-DD` uniquement — toute autre forme est ignorée plutôt que devinée. */
function readIsoDate(params: RawSearchParams | URLSearchParams, key: string): string | null {
  const value = readNullableString(params, key);
  if (value === null) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function readStatut(params: RawSearchParams | URLSearchParams): ProspectStatut | null {
  const value = readNullableString(params, 'statut');
  if (value === null) return null;
  return PROSPECT_STATUTS.includes(value as ProspectStatut) ? (value as ProspectStatut) : null;
}

/**
 * Lecteur d'énumération générique.
 *
 * Écrit une fois plutôt que recopié cinq fois : chaque copie serait une
 * occasion d'oublier la validation, et une valeur inconnue collée dans l'URL
 * partirait telle quelle vers l'API — qui répondrait 400 sur un écran que
 * l'utilisateur n'a fait qu'ouvrir depuis un lien.
 */
function readEnum<T extends string>(
  params: RawSearchParams | URLSearchParams,
  key: string,
  allowed: readonly T[],
): T | null {
  const value = readNullableString(params, key);
  if (value === null) return null;
  return (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

function readSortBy(params: RawSearchParams | URLSearchParams): ProspectSortField {
  const value = readNullableString(params, 'sortBy');
  if (value === null) return EMPTY_FILTERS.sortBy;
  return PROSPECT_SORT_FIELDS.includes(value as ProspectSortField)
    ? (value as ProspectSortField)
    : EMPTY_FILTERS.sortBy;
}

function readSortDir(params: RawSearchParams | URLSearchParams): SortDirection {
  return readNullableString(params, 'sortDir') === 'asc' ? 'asc' : 'desc';
}

/**
 * Analyse tolérante : une valeur inconnue est écartée, jamais propagée vers
 * l'API. Une URL bricolée à la main ne doit pas produire un 400 côté serveur.
 */
export function parseProspectFilters(params: RawSearchParams | URLSearchParams): ProspectFilters {
  const pageSize = readPositiveInt(params, 'pageSize', DEFAULT_PAGE_SIZE);
  return {
    search: readNullableString(params, 'search') ?? '',
    commercialId: readNullableString(params, 'commercialId'),
    representantId: readNullableString(params, 'representantId'),
    departementId: readNullableString(params, 'departementId'),
    banqueId: readNullableString(params, 'banqueId'),
    syndicatId: readNullableString(params, 'syndicatId'),
    statut: readStatut(params),
    segment: readEnum<BddSegment>(params, 'segment', BDD_SEGMENTS),
    phase2Status: readEnum<Phase2Status>(params, 'phase2Status', PHASE2_STATUSES),
    enrollmentMethod: readEnum<EnrollmentMethod>(params, 'enrollmentMethod', ENROLLMENT_METHODS),
    campaignId: readNullableString(params, 'campaignId'),
    enrollmentCapturedById: readNullableString(params, 'enrollmentCapturedById'),
    dateFrom: readIsoDate(params, 'dateFrom'),
    dateTo: readIsoDate(params, 'dateTo'),
    page: readPositiveInt(params, 'page', 1),
    pageSize: (PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSize)
      ? pageSize
      : DEFAULT_PAGE_SIZE,
    sortBy: readSortBy(params),
    sortDir: readSortDir(params),
  };
}

/**
 * Sérialisation canonique : les valeurs par défaut sont omises, et les clés
 * sont écrites dans un ordre fixe. Deux filtres égaux produisent donc la même
 * chaîne — ce qui en fait une clé de cache React Query utilisable telle quelle.
 */
export function serializeProspectFilters(filters: ProspectFilters): URLSearchParams {
  const params = new URLSearchParams();
  const put = (key: string, value: string | null): void => {
    if (value !== null && value !== '') params.set(key, value);
  };

  put('search', filters.search.trim());
  put('commercialId', filters.commercialId);
  put('representantId', filters.representantId);
  put('departementId', filters.departementId);
  put('banqueId', filters.banqueId);
  put('syndicatId', filters.syndicatId);
  put('statut', filters.statut);
  put('segment', filters.segment);
  put('phase2Status', filters.phase2Status);
  put('enrollmentMethod', filters.enrollmentMethod);
  put('campaignId', filters.campaignId);
  put('enrollmentCapturedById', filters.enrollmentCapturedById);
  put('dateFrom', filters.dateFrom);
  put('dateTo', filters.dateTo);
  if (filters.page !== 1) put('page', String(filters.page));
  if (filters.pageSize !== DEFAULT_PAGE_SIZE) put('pageSize', String(filters.pageSize));
  if (filters.sortBy !== EMPTY_FILTERS.sortBy) put('sortBy', filters.sortBy);
  if (filters.sortDir !== EMPTY_FILTERS.sortDir) put('sortDir', filters.sortDir);

  return params;
}

/** Clé de requête React Query, stable et sérialisable. */
export function filtersQueryKey(filters: ProspectFilters): string {
  return serializeProspectFilters(filters).toString();
}

// ─── Filtrage simple / filtrage avancé ───────────────────────────────────────

/**
 * Les critères rangés derrière « Filtres avancés ».
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Pourquoi ce partage, et pourquoi CETTE liste.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Treize champs empilés en permanence poussaient les indicateurs sous la ligne
 * de flottaison : la première chose visible du tableau de bord était un
 * formulaire, pas un chiffre. Restent visibles les trois critères qu'on touche
 * à chaque session — la recherche, la période, le téléconseiller. Les dix
 * autres servent à une question précise, quelques fois par mois.
 *
 * La liste est ORDONNÉE comme les champs à l'écran : les puces de rappel
 * suivent l'ordre du panneau, si bien qu'une puce se retrouve à l'œil sans
 * avoir à parcourir dix listes déroulantes.
 */
export const ADVANCED_FILTER_KEYS = [
  'representantId',
  'departementId',
  'banqueId',
  'syndicatId',
  'statut',
  'segment',
  'phase2Status',
  'enrollmentMethod',
  'campaignId',
  'enrollmentCapturedById',
] as const;

export type AdvancedFilterKey = (typeof ADVANCED_FILTER_KEYS)[number];

/** Les critères avancés RÉELLEMENT renseignés, dans l'ordre des champs. */
export function activeAdvancedKeys(filters: ProspectFilters): AdvancedFilterKey[] {
  return ADVANCED_FILTER_KEYS.filter((key) => filters[key] !== null);
}

export function countAdvancedFilters(filters: ProspectFilters): number {
  return activeAdvancedKeys(filters).length;
}

export function hasAdvancedFilters(filters: ProspectFilters): boolean {
  return ADVANCED_FILTER_KEYS.some((key) => filters[key] !== null);
}

/**
 * Remise à zéro des SEULS critères avancés. La recherche, la période et le
 * téléconseiller restent : ce sont ceux que l'utilisateur voit, et effacer un
 * champ visible depuis un bouton rangé ailleurs se lit comme un défaut.
 *
 * Écrit champ par champ plutôt qu'en `Object.fromEntries` : la forme littérale
 * est vérifiée par le compilateur, si bien qu'un critère renommé dans
 * `ProspectFilters` casse ici au lieu d'être silencieusement oublié.
 */
export function clearAdvancedFilters(): Partial<ProspectFilters> {
  return {
    representantId: null,
    departementId: null,
    banqueId: null,
    syndicatId: null,
    statut: null,
    segment: null,
    phase2Status: null,
    enrollmentMethod: null,
    campaignId: null,
    enrollmentCapturedById: null,
  } satisfies Record<AdvancedFilterKey, null>;
}

/**
 * État initial du panneau « Filtres avancés ».
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * L'URL l'emporte sur la préférence enregistrée, et ce n'est pas négociable.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un lien filtré se colle dans un message : c'est le principe de cet écran
 * (voir `useProspectFilters`). Ouvrir ce lien avec le panneau replié parce que
 * le destinataire l'avait fermé la veille afficherait un tableau restreint sans
 * qu'aucun champ visible n'explique pourquoi. Il lirait un chiffre faux en
 * croyant lire le total.
 *
 * `stored` vaut `null` tant que rien n'a été enregistré, et pendant le rendu
 * serveur — où `localStorage` n'existe pas.
 */
export function initialAdvancedOpen(filters: ProspectFilters, stored: boolean | null): boolean {
  if (hasAdvancedFilters(filters)) return true;
  return stored ?? false;
}

/** Ce qui compte comme « filtre actif » pour l'affichage du bouton de remise à zéro. */
export function countActiveFilters(filters: ProspectFilters): number {
  let count = 0;
  if (filters.search.trim() !== '') count += 1;
  if (filters.commercialId !== null) count += 1;
  if (filters.representantId !== null) count += 1;
  if (filters.departementId !== null) count += 1;
  if (filters.banqueId !== null) count += 1;
  if (filters.syndicatId !== null) count += 1;
  if (filters.statut !== null) count += 1;
  if (filters.segment !== null) count += 1;
  if (filters.phase2Status !== null) count += 1;
  if (filters.enrollmentMethod !== null) count += 1;
  if (filters.campaignId !== null) count += 1;
  if (filters.enrollmentCapturedById !== null) count += 1;
  if (filters.dateFrom !== null || filters.dateTo !== null) count += 1;
  return count;
}
