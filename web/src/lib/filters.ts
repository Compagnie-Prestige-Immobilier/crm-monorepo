import {
  readEnum,
  readFrenchBoolean,
  readIsoDate,
  readPositiveInt,
  readString,
  type RawSearchParams,
} from '@/lib/search-params';
import {
  BDD_SEGMENTS,
  ENROLLMENT_METHODS,
  MODE_EPARGNES,
  PAYMENT_MODES,
  PHASE2_STATUSES,
  PROSPECT_ORIGINS,
  PROSPECT_SORT_FIELDS,
  PROSPECT_STATUTS,
  PROSPECT_TYPES,
  RENDEZ_VOUS_ISSUES,
  TYPE_CONTRATS,
  TYPES_BIEN,
  type BddSegment,
  type EnrollmentMethod,
  type ModeEpargne,
  type PaymentMode,
  type Phase2Status,
  type ProspectFilters,
  type ProspectOrigin,
  type ProspectSortField,
  type ProspectStatut,
  type ProspectType,
  type RendezVousIssue,
  type SortDirection,
  type TypeBien,
  type TypeContrat,
} from '@/lib/types';

const PROJETS = ['CHUES', 'GRAND_PUBLIC'] as const;

export const DEFAULT_PAGE_SIZE = 25;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export const EMPTY_FILTERS: ProspectFilters = {
  projet: null,
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
  enrollmentCapturedById: null,
  revue: null,
  sansMotif: null,
  motif: null,
  campagneId: null,
  type: null,
  canalProvenanceId: null,
  origin: null,
  professionId: null,
  incomeBandId: null,
  employeurId: null,
  paysResidenceId: null,
  paymentMode: null,
  typeBien: null,
  typeContrat: null,
  modeEpargne: null,
  rendezVousIssue: null,
  avecRdv: null,
  avecCommentaire: null,
  appelePar: null,
  lastCallById: null,
  dateFrom: null,
  dateTo: null,
  rdvFrom: null,
  rdvTo: null,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  sortBy: 'clientCreatedAt',
  sortDir: 'desc',
};

export type { RawSearchParams };

function readStatut(params: RawSearchParams | URLSearchParams): ProspectStatut | null {
  return readEnum<ProspectStatut>(params, 'statut', PROSPECT_STATUTS);
}

function readSortBy(params: RawSearchParams | URLSearchParams): ProspectSortField {
  return (
    readEnum<ProspectSortField>(params, 'sortBy', PROSPECT_SORT_FIELDS) ?? EMPTY_FILTERS.sortBy
  );
}

function readProjet(params: RawSearchParams | URLSearchParams): (typeof PROJETS)[number] | null {
  const raw = readString(params, 'projet');
  if (raw === null) return null;
  const upper = raw.toUpperCase().replaceAll(/[\s+]+/gu, '_');
  if (upper === 'GRAND_PUBLIC' || upper === 'GRANDPUBLIC') return 'GRAND_PUBLIC';
  if (upper === 'CHUES') return 'CHUES';
  return null;
}

function readSortDir(params: RawSearchParams | URLSearchParams): SortDirection {
  return readString(params, 'sortDir') === 'asc' ? 'asc' : 'desc';
}

function readPhase2StatusFiltre(
  params: RawSearchParams | URLSearchParams,
): Phase2Status | 'TOUT' | null {
  if (readString(params, 'phase2Status') === 'TOUT') return 'TOUT';
  return readEnum<Phase2Status>(params, 'phase2Status', PHASE2_STATUSES);
}

export function parseProspectFilters(params: RawSearchParams | URLSearchParams): ProspectFilters {
  const pageSize = readPositiveInt(params, 'pageSize', DEFAULT_PAGE_SIZE);
  return {
    projet: readProjet(params),
    search: readString(params, 'search') ?? '',
    commercialId: readString(params, 'commercialId'),
    representantId: readString(params, 'representantId'),
    departementId: readString(params, 'departementId'),
    banqueId: readString(params, 'banqueId'),
    syndicatId: readString(params, 'syndicatId'),
    statut: readStatut(params),
    segment: readEnum<BddSegment>(params, 'segment', BDD_SEGMENTS),
    phase2Status: readPhase2StatusFiltre(params),
    enrollmentMethod: readEnum<EnrollmentMethod>(params, 'enrollmentMethod', ENROLLMENT_METHODS),
    enrollmentCapturedById: readString(params, 'enrollmentCapturedById'),
    revue: readFrenchBoolean(params, 'revue'),
    sansMotif: readString(params, 'sansMotif'),
    motif: readString(params, 'motif'),
    campagneId: readString(params, 'campagneId'),
    type: readEnum<ProspectType>(params, 'type', PROSPECT_TYPES),
    canalProvenanceId: readString(params, 'canalProvenanceId'),
    origin: readEnum<ProspectOrigin>(params, 'origin', PROSPECT_ORIGINS),
    professionId: readString(params, 'professionId'),
    incomeBandId: readString(params, 'incomeBandId'),
    employeurId: readString(params, 'employeurId'),
    paysResidenceId: readString(params, 'paysResidenceId'),
    paymentMode: readEnum<PaymentMode>(params, 'paymentMode', PAYMENT_MODES),
    typeBien: readEnum<TypeBien>(params, 'typeBien', TYPES_BIEN),
    typeContrat: readEnum<TypeContrat>(params, 'typeContrat', TYPE_CONTRATS),
    modeEpargne: readEnum<ModeEpargne>(params, 'modeEpargne', MODE_EPARGNES),
    rendezVousIssue: readEnum<RendezVousIssue | 'SANS'>(
      params,
      'rendezVousIssue',
      RENDEZ_VOUS_ISSUES,
    ),
    avecRdv: readFrenchBoolean(params, 'avecRdv'),
    avecCommentaire: readFrenchBoolean(params, 'avecCommentaire'),
    appelePar: readString(params, 'appelePar'),
    lastCallById: readString(params, 'lastCallById'),
    dateFrom: readIsoDate(params, 'dateFrom'),
    dateTo: readIsoDate(params, 'dateTo'),
    rdvFrom: readIsoDate(params, 'rdvFrom'),
    rdvTo: readIsoDate(params, 'rdvTo'),
    page: readPositiveInt(params, 'page', 1),
    pageSize: (PAGE_SIZE_OPTIONS as readonly number[]).includes(pageSize)
      ? pageSize
      : DEFAULT_PAGE_SIZE,
    sortBy: readSortBy(params),
    sortDir: readSortDir(params),
  };
}

function ouiNon(value: boolean | null): string | null {
  if (value === null) return null;
  return value ? 'oui' : 'non';
}

export function serializeProspectFilters(filters: ProspectFilters): URLSearchParams {
  const params = new URLSearchParams();
  const put = (key: string, value: string | null): void => {
    if (value !== null && value !== '') params.set(key, value);
  };

  put('search', filters.search.trim());
  put('projet', filters.projet);
  put('commercialId', filters.commercialId);
  put('representantId', filters.representantId);
  put('departementId', filters.departementId);
  put('banqueId', filters.banqueId);
  put('syndicatId', filters.syndicatId);
  put('statut', filters.statut);
  put('segment', filters.segment);
  put('phase2Status', filters.phase2Status);
  put('enrollmentMethod', filters.enrollmentMethod);
  put('enrollmentCapturedById', filters.enrollmentCapturedById);
  put('revue', ouiNon(filters.revue));
  put('sansMotif', filters.sansMotif);
  put('motif', filters.motif);
  put('campagneId', filters.campagneId);
  put('type', filters.type);
  put('canalProvenanceId', filters.canalProvenanceId);
  put('origin', filters.origin);
  put('professionId', filters.professionId);
  put('incomeBandId', filters.incomeBandId);
  put('employeurId', filters.employeurId);
  put('paysResidenceId', filters.paysResidenceId);
  put('paymentMode', filters.paymentMode);
  put('typeBien', filters.typeBien);
  put('typeContrat', filters.typeContrat);
  put('modeEpargne', filters.modeEpargne);
  put('rendezVousIssue', filters.rendezVousIssue);
  put('avecRdv', ouiNon(filters.avecRdv));
  put('avecCommentaire', ouiNon(filters.avecCommentaire));
  put('appelePar', filters.appelePar);
  put('lastCallById', filters.lastCallById);
  put('dateFrom', filters.dateFrom);
  put('dateTo', filters.dateTo);
  put('rdvFrom', filters.rdvFrom);
  put('rdvTo', filters.rdvTo);
  if (filters.page !== 1) put('page', String(filters.page));
  if (filters.pageSize !== DEFAULT_PAGE_SIZE) put('pageSize', String(filters.pageSize));
  if (filters.sortBy !== EMPTY_FILTERS.sortBy) put('sortBy', filters.sortBy);
  if (filters.sortDir !== EMPTY_FILTERS.sortDir) put('sortDir', filters.sortDir);

  return params;
}

export function filtersQueryKey(filters: ProspectFilters): string {
  return serializeProspectFilters(filters).toString();
}

export const ADVANCED_FILTER_KEYS = [
  'representantId',
  'departementId',
  'banqueId',
  'syndicatId',
  'statut',
  'segment',
  'phase2Status',
  'enrollmentMethod',
  'enrollmentCapturedById',
  'revue',
] as const;

export type AdvancedFilterKey = (typeof ADVANCED_FILTER_KEYS)[number];

/**
 * Ce qui reste dans le panneau replié, une fois les critères portés par un
 * en-tête de colonne retirés : eux se voient sur le tableau.
 */
export const PROSPECT_ADVANCED_KEYS: readonly AdvancedFilterKey[] = ['revue'];

export const GRAND_PUBLIC_ADVANCED_KEYS: readonly AdvancedFilterKey[] = [
  'representantId',
  'departementId',
  'syndicatId',
];

export function clearAdvancedFilters(keys: readonly AdvancedFilterKey[]): Partial<ProspectFilters> {
  return Object.fromEntries(keys.map((key) => [key, null])) as Partial<ProspectFilters>;
}

export function advancedOpenFrom(hasAdvanced: boolean, stored: boolean | null): boolean {
  if (hasAdvanced) return true;
  return stored ?? false;
}

export function countActiveFilters(filters: ProspectFilters): number {
  const filtresActifs = [
    filters.search.trim() !== '',
    filters.commercialId !== null,
    filters.representantId !== null,
    filters.departementId !== null,
    filters.banqueId !== null,
    filters.syndicatId !== null,
    filters.statut !== null,
    filters.segment !== null,
    filters.phase2Status !== null,
    filters.enrollmentMethod !== null,
    filters.enrollmentCapturedById !== null,
    filters.revue !== null,
    filters.campagneId !== null,
    filters.type !== null,
    filters.canalProvenanceId !== null,
    filters.origin !== null,
    filters.professionId !== null,
    filters.incomeBandId !== null,
    filters.employeurId !== null,
    filters.paysResidenceId !== null,
    filters.paymentMode !== null,
    filters.typeBien !== null,
    filters.typeContrat !== null,
    filters.modeEpargne !== null,
    filters.rendezVousIssue !== null,
    filters.avecRdv !== null,
    filters.avecCommentaire !== null,
    filters.appelePar !== null,
    filters.lastCallById !== null,
    filters.dateFrom !== null || filters.dateTo !== null,
    filters.rdvFrom !== null || filters.rdvTo !== null,
  ];
  return filtresActifs.filter(Boolean).length;
}
