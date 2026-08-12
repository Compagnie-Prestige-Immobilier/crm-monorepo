import type { operations } from '@crm/api-client';

import { isMoneyString } from '@/lib/money';
import {
  BANK_CASE_SORT_FIELDS,
  type BankCaseSortField,
  type BankStageType,
  type SortDirection,
} from '@/lib/types';

/**
 * Filtre unique de Banque & Finance — même dispositif que `ProspectFilters`, et
 * pour la même raison.
 *
 * UN objet pilote la liste, le tableau de bord et l'export. Un agent qui envoie
 * le classeur à sa direction doit pouvoir jurer qu'il contient exactement ce
 * qu'il avait sous les yeux, et un lien collé dans un message doit rouvrir le
 * même écran. L'état vit dans l'URL ; il n'existe aucune copie dans un store.
 *
 * Les bornes de montant restent des CHAÎNES d'un bout à l'autre (voir
 * `lib/money.ts`) : les convertir pour les remettre en chaîne réintroduirait
 * exactement la perte de précision que le contrat évite.
 */

export type BankCaseQuery = NonNullable<operations['listBankCases']['parameters']['query']>;
export type BankAnalyticsQuery = NonNullable<
  operations['getBankCaseAnalytics']['parameters']['query']
>;

export const BANK_DEFAULT_PAGE_SIZE = 25;
export const BANK_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

const STAGE_TYPES: readonly BankStageType[] = ['OPEN', 'CASHED', 'REJECTED'];

export interface BankCaseFilters {
  search: string;
  stageId: string | null;
  stageType: BankStageType | null;
  bankId: string | null;
  agentId: string | null;
  rejectionReasonId: string | null;
  /** Bornes incluses, `YYYY-MM-DD`, sur la création du dossier. */
  dateFrom: string | null;
  dateTo: string | null;
  /** Bornes de montant, en chaîne de chiffres. Jamais un nombre. */
  amountMin: string | null;
  amountMax: string | null;
  page: number;
  pageSize: number;
  sortBy: BankCaseSortField;
  sortDir: SortDirection;
}

export const EMPTY_BANK_FILTERS: BankCaseFilters = {
  search: '',
  stageId: null,
  stageType: null,
  bankId: null,
  agentId: null,
  rejectionReasonId: null,
  dateFrom: null,
  dateTo: null,
  amountMin: null,
  amountMax: null,
  page: 1,
  pageSize: BANK_DEFAULT_PAGE_SIZE,
  sortBy: 'updatedAt',
  sortDir: 'desc',
};

export type RawSearchParams = Record<string, string | string[] | undefined>;

function readOne(params: RawSearchParams | URLSearchParams, key: string): string | null {
  if (params instanceof URLSearchParams) return params.get(key);
  const raw = params[key];
  if (Array.isArray(raw)) return raw[0] ?? null;
  return raw ?? null;
}

function readString(params: RawSearchParams | URLSearchParams, key: string): string | null {
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
  const value = readString(params, key);
  if (value === null) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readIsoDate(params: RawSearchParams | URLSearchParams, key: string): string | null {
  const value = readString(params, key);
  if (value === null) return null;
  return /^\d{4}-\d{2}-\d{2}$/u.test(value) ? value : null;
}

/** Une borne de montant qui n'est pas un entier de chiffres est ÉCARTÉE. */
function readMoney(params: RawSearchParams | URLSearchParams, key: string): string | null {
  const value = readString(params, key);
  if (value === null) return null;
  return isMoneyString(value) ? value : null;
}

/** Analyse tolérante : une valeur inconnue est écartée, jamais relayée à l'API. */
export function parseBankFilters(params: RawSearchParams | URLSearchParams): BankCaseFilters {
  const pageSize = readPositiveInt(params, 'pageSize', BANK_DEFAULT_PAGE_SIZE);
  const stageType = readString(params, 'stageType');
  const sortBy = readString(params, 'sortBy');

  return {
    search: readString(params, 'search') ?? '',
    stageId: readString(params, 'stageId'),
    stageType:
      stageType !== null && (STAGE_TYPES as readonly string[]).includes(stageType)
        ? (stageType as BankStageType)
        : null,
    bankId: readString(params, 'bankId'),
    agentId: readString(params, 'agentId'),
    rejectionReasonId: readString(params, 'rejectionReasonId'),
    dateFrom: readIsoDate(params, 'dateFrom'),
    dateTo: readIsoDate(params, 'dateTo'),
    amountMin: readMoney(params, 'amountMin'),
    amountMax: readMoney(params, 'amountMax'),
    page: readPositiveInt(params, 'page', 1),
    pageSize: (BANK_PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSize)
      ? pageSize
      : BANK_DEFAULT_PAGE_SIZE,
    sortBy:
      sortBy !== null && (BANK_CASE_SORT_FIELDS as readonly string[]).includes(sortBy)
        ? (sortBy as BankCaseSortField)
        : EMPTY_BANK_FILTERS.sortBy,
    sortDir: readString(params, 'sortDir') === 'asc' ? 'asc' : 'desc',
  };
}

/** Sérialisation canonique : défauts omis, ordre de clés fixe, donc clé de cache. */
export function serializeBankFilters(filters: BankCaseFilters): URLSearchParams {
  const params = new URLSearchParams();
  const put = (key: string, value: string | null): void => {
    if (value !== null && value !== '') params.set(key, value);
  };

  put('search', filters.search.trim());
  put('stageId', filters.stageId);
  put('stageType', filters.stageType);
  put('bankId', filters.bankId);
  put('agentId', filters.agentId);
  put('rejectionReasonId', filters.rejectionReasonId);
  put('dateFrom', filters.dateFrom);
  put('dateTo', filters.dateTo);
  put('amountMin', filters.amountMin);
  put('amountMax', filters.amountMax);
  if (filters.page !== 1) put('page', String(filters.page));
  if (filters.pageSize !== BANK_DEFAULT_PAGE_SIZE) put('pageSize', String(filters.pageSize));
  if (filters.sortBy !== EMPTY_BANK_FILTERS.sortBy) put('sortBy', filters.sortBy);
  if (filters.sortDir !== EMPTY_BANK_FILTERS.sortDir) put('sortDir', filters.sortDir);

  return params;
}

export function bankFiltersQueryKey(filters: BankCaseFilters): string {
  return serializeBankFilters(filters).toString();
}

export function countActiveBankFilters(filters: BankCaseFilters): number {
  let count = 0;
  if (filters.search.trim() !== '') count += 1;
  if (filters.stageId !== null) count += 1;
  if (filters.stageType !== null) count += 1;
  if (filters.bankId !== null) count += 1;
  if (filters.agentId !== null) count += 1;
  if (filters.rejectionReasonId !== null) count += 1;
  if (filters.dateFrom !== null || filters.dateTo !== null) count += 1;
  if (filters.amountMin !== null || filters.amountMax !== null) count += 1;
  return count;
}

/**
 * Bornes de journée explicitées, exactement comme pour les prospects : sans
 * heure, `dateTo=2026-08-12` serait interprété comme minuit pile et exclurait
 * toute la journée du 12. L'heure métier est `Africa/Dakar`, soit UTC+0 toute
 * l'année — `Z` est donc exact, sans conversion.
 */
const startOfDay = (isoDate: string): string => `${isoDate}T00:00:00.000Z`;
const endOfDay = (isoDate: string): string => `${isoDate}T23:59:59.999Z`;

/** Critères de sélection seuls — communs à la liste, aux agrégats et à l'export. */
export function toBankFilterQuery(filters: BankCaseFilters): BankAnalyticsQuery {
  const query: BankAnalyticsQuery = {};

  const search = filters.search.trim();
  if (search !== '') query.search = search;
  if (filters.stageId !== null) query.stageId = filters.stageId;
  if (filters.stageType !== null) query.stageType = filters.stageType;
  if (filters.bankId !== null) query.bankId = filters.bankId;
  if (filters.agentId !== null) query.agentId = filters.agentId;
  if (filters.rejectionReasonId !== null) query.rejectionReasonId = filters.rejectionReasonId;
  if (filters.dateFrom !== null) query.dateFrom = startOfDay(filters.dateFrom);
  if (filters.dateTo !== null) query.dateTo = endOfDay(filters.dateTo);
  if (filters.amountMin !== null) query.amountMin = filters.amountMin;
  if (filters.amountMax !== null) query.amountMax = filters.amountMax;

  return query;
}

/** Les mêmes critères, plus la pagination et le tri du tableau. */
export function toBankCaseQuery(filters: BankCaseFilters): BankCaseQuery {
  return {
    ...toBankFilterQuery(filters),
    page: filters.page,
    pageSize: filters.pageSize,
    sortBy: filters.sortBy,
    sortOrder: filters.sortDir,
  };
}

/**
 * Vues rapides de la liste. Ce ne sont pas des filtres supplémentaires : chacune
 * s'écrit dans le MÊME objet, donc dans la même URL, et l'export les suit.
 */
export type BankQuickView = 'tous' | 'a-traiter' | 'en-cours' | 'encaisses' | 'rejetes';

export const BANK_QUICK_VIEWS: readonly { id: BankQuickView; label: string }[] = [
  { id: 'tous', label: 'Tous' },
  { id: 'a-traiter', label: 'À traiter' },
  { id: 'en-cours', label: 'En cours' },
  { id: 'encaisses', label: 'Encaissés' },
  { id: 'rejetes', label: 'Rejetés' },
];

/**
 * Traduit une vue rapide en patch de filtre.
 *
 * « À traiter » vise l'étape INITIALE, qui n'est pas connue à la compilation :
 * elle est configurable et peut être renommée. Elle est donc passée en
 * paramètre plutôt que devinée par son code.
 */
export function quickViewPatch(
  view: BankQuickView,
  initialStageId: string | null,
): Partial<BankCaseFilters> {
  switch (view) {
    case 'a-traiter':
      return { stageId: initialStageId, stageType: null };
    case 'en-cours':
      // Type OPEN sans étape imposée : « en cours » couvre toutes les étapes
      // ouvertes, y compris celles ajoutées par un administrateur plus tard.
      return { stageId: null, stageType: 'OPEN' };
    case 'encaisses':
      return { stageId: null, stageType: 'CASHED' };
    case 'rejetes':
      return { stageId: null, stageType: 'REJECTED' };
    default:
      return { stageId: null, stageType: null };
  }
}

/** Vue rapide correspondant à l'état courant, pour surligner le bon onglet. */
export function activeQuickView(
  filters: BankCaseFilters,
  initialStageId: string | null,
): BankQuickView {
  if (filters.stageId !== null && filters.stageId === initialStageId) return 'a-traiter';
  if (filters.stageId !== null) return 'tous';
  if (filters.stageType === 'OPEN') return 'en-cours';
  if (filters.stageType === 'CASHED') return 'encaisses';
  if (filters.stageType === 'REJECTED') return 'rejetes';
  return 'tous';
}
