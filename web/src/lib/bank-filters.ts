import type { operations } from '@crm/api-client';

import { isMoneyString } from '@/lib/money';
import {
  readIsoDate,
  readPositiveInt,
  readString,
  type RawSearchParams,
} from '@/lib/search-params';
import {
  BANK_CASE_SORT_FIELDS,
  type BankCaseSortField,
  type BankStageType,
  type Projet,
  type SortDirection,
} from '@/lib/types';

export type BankCaseQuery = NonNullable<operations['get-api-v1-bank-cases']['parameters']['query']>;
export type BankAnalyticsQuery = NonNullable<
  operations['get-api-v1-bank-cases-analytics']['parameters']['query']
>;

const BANK_DEFAULT_PAGE_SIZE = 25;
export const BANK_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

const STAGE_TYPES: readonly BankStageType[] = ['OPEN', 'CASHED', 'REJECTED'];

const PROJETS: readonly Projet[] = ['CHUES', 'GRAND_PUBLIC'];

/**
 * La coque à laquelle appartient un écran bancaire. Elle vient de la PAGE, pas
 * de la barre de filtres : `null` ne se produit que sur la route d'export, qui
 * relit le paramètre écrit par `buildBankExportUrl`.
 */
export interface BankCaseFilters {
  projet: Projet | null;
  search: string;
  stageId: string | null;
  stageType: BankStageType | null;
  banqueId: string | null;
  agentId: string | null;
  rejectionReasonId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  amountMin: string | null;
  amountMax: string | null;
  page: number;
  pageSize: number;
  sortBy: BankCaseSortField;
  sortDir: SortDirection;
}

export const EMPTY_BANK_FILTERS: BankCaseFilters = {
  projet: null,
  search: '',
  stageId: null,
  stageType: null,
  banqueId: null,
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

export type { RawSearchParams };

function readMoney(params: RawSearchParams | URLSearchParams, key: string): string | null {
  const value = readString(params, key);
  if (value === null) return null;
  return isMoneyString(value) ? value : null;
}

export function parseBankFilters(params: RawSearchParams | URLSearchParams): BankCaseFilters {
  const pageSize = readPositiveInt(params, 'pageSize', BANK_DEFAULT_PAGE_SIZE);
  const stageType = readString(params, 'stageType');
  const sortBy = readString(params, 'sortBy');
  const projet = readString(params, 'projet');

  return {
    projet:
      projet !== null && (PROJETS as readonly string[]).includes(projet)
        ? (projet as Projet)
        : null,
    search: readString(params, 'search') ?? '',
    stageId: readString(params, 'stageId'),
    stageType:
      stageType !== null && (STAGE_TYPES as readonly string[]).includes(stageType)
        ? (stageType as BankStageType)
        : null,
    banqueId: readString(params, 'banqueId'),
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

export function serializeBankFilters(filters: BankCaseFilters): URLSearchParams {
  const params = new URLSearchParams();
  const put = (key: string, value: string | null): void => {
    if (value !== null && value !== '') params.set(key, value);
  };

  put('projet', filters.projet);
  put('search', filters.search.trim());
  put('stageId', filters.stageId);
  put('stageType', filters.stageType);
  put('banqueId', filters.banqueId);
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

/** Le projet EN TÊTE : les deux coques ne doivent jamais partager une entrée de cache. */
export function bankFiltersQueryKey(filters: BankCaseFilters): string {
  const params = serializeBankFilters(filters);
  if (filters.projet !== null) params.set('projet', filters.projet);
  return params.toString();
}

export const FINANCE_BASE_PATH = '/finance';

/** Racine de la coque qui porte les écrans bancaires. */
export function bankBasePath(_projet?: Projet | null): string {
  return FINANCE_BASE_PATH;
}

export function countActiveBankFilters(filters: BankCaseFilters): number {
  const activeFlags = [
    filters.projet !== null,
    filters.search.trim() !== '',
    filters.stageId !== null,
    filters.stageType !== null,
    filters.banqueId !== null,
    filters.agentId !== null,
    filters.rejectionReasonId !== null,
    filters.dateFrom !== null || filters.dateTo !== null,
    filters.amountMin !== null || filters.amountMax !== null,
  ];
  return activeFlags.filter(Boolean).length;
}

export const BANK_ADVANCED_FILTER_KEYS = [
  'banqueId',
  'agentId',
  'rejectionReasonId',
  'amountMin',
  'amountMax',
] as const;

export type BankAdvancedFilterKey = (typeof BANK_ADVANCED_FILTER_KEYS)[number];

export function clearBankAdvancedFilters(): Partial<BankCaseFilters> {
  return {
    banqueId: null,
    agentId: null,
    rejectionReasonId: null,
    amountMin: null,
    amountMax: null,
  } satisfies Record<BankAdvancedFilterKey, null>;
}

const startOfDay = (isoDate: string): string => `${isoDate}T00:00:00.000Z`;
const endOfDay = (isoDate: string): string => `${isoDate}T23:59:59.999Z`;

function toBankIdentityQuery(filters: BankCaseFilters): BankAnalyticsQuery {
  const query: BankAnalyticsQuery = {};

  if (filters.projet !== null) query.projet = filters.projet;
  const search = filters.search.trim();
  if (search !== '') query.search = search;
  if (filters.stageId !== null) query.stageId = filters.stageId;
  if (filters.stageType !== null) query.stageType = filters.stageType;
  if (filters.banqueId !== null) query.banqueId = filters.banqueId;

  return query;
}

function toBankRangeQuery(filters: BankCaseFilters): BankAnalyticsQuery {
  const query: BankAnalyticsQuery = {};

  if (filters.agentId !== null) query.agentId = filters.agentId;
  if (filters.rejectionReasonId !== null) query.rejectionReasonId = filters.rejectionReasonId;
  if (filters.dateFrom !== null) query.dateFrom = startOfDay(filters.dateFrom);
  if (filters.dateTo !== null) query.dateTo = endOfDay(filters.dateTo);
  if (filters.amountMin !== null) query.amountMin = filters.amountMin;
  if (filters.amountMax !== null) query.amountMax = filters.amountMax;

  return query;
}

export function toBankFilterQuery(filters: BankCaseFilters): BankAnalyticsQuery {
  return { ...toBankIdentityQuery(filters), ...toBankRangeQuery(filters) };
}

export function toBankCaseQuery(filters: BankCaseFilters): BankCaseQuery {
  return {
    ...toBankFilterQuery(filters),
    page: filters.page,
    pageSize: filters.pageSize,
    sortBy: filters.sortBy,
    sortOrder: filters.sortDir,
  };
}

export type BankQuickView = 'tous' | 'a-traiter' | 'en-cours' | 'encaisses' | 'rejetes';

export const BANK_QUICK_VIEWS: readonly { id: BankQuickView; label: string }[] = [
  { id: 'tous', label: 'Tous' },
  { id: 'a-traiter', label: 'À traiter' },
  { id: 'en-cours', label: 'En cours' },
  { id: 'encaisses', label: 'Encaissés' },
  { id: 'rejetes', label: 'Rejetés' },
];

export function quickViewPatch(
  view: BankQuickView,
  initialStageId: string | null,
): Partial<BankCaseFilters> {
  switch (view) {
    case 'a-traiter':
      return { stageId: initialStageId, stageType: null };
    case 'en-cours':
      return { stageId: null, stageType: 'OPEN' };
    case 'encaisses':
      return { stageId: null, stageType: 'CASHED' };
    case 'rejetes':
      return { stageId: null, stageType: 'REJECTED' };
    default:
      return { stageId: null, stageType: null };
  }
}

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
