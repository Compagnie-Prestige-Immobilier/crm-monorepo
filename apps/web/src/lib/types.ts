import type { components } from '@crm/api-client';

type Schemas = components['schemas'];

export type Role = Schemas['Role'];
export type ProspectStatut = Schemas['ProspectStatut'];

export type Region = Schemas['RegionDto'];
export type Departement = Schemas['DepartementDto'];
export type Ief = Schemas['IefDto'];
export type Banque = Schemas['BanqueDto'];
export type Syndicat = Schemas['SyndicatDto'];

export type SessionUser = Schemas['AuthUserDto'];
export type UserRow = Schemas['UserDto'];
export type RepresentantRow = Schemas['RepresentantDto'];
export type ProspectRow = Schemas['ProspectDto'];

export type CreateUserInput = Schemas['CreateUserDto'];
export type UpdateUserInput = Schemas['UpdateUserDto'];
export type UpdateProspectInput = Schemas['UpdateProspectDto'];
export type UpdateRepresentantInput = Schemas['UpdateRepresentantDto'];

export const PROSPECT_STATUTS = [
  'NOUVEAU',
  'CONTACTE',
  'CONVERTI',
  'PERDU',
] as const satisfies readonly ProspectStatut[];

export const PROSPECT_STATUT_LABELS: Record<ProspectStatut, string> = {
  NOUVEAU: 'Nouveau',
  CONTACTE: 'Contacté',
  CONVERTI: 'Converti',
  PERDU: 'Perdu',
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrateur',
  COMMERCIAL: 'Téléconseiller',
  BANQUE_FINANCE: 'Banque & Finance',
  SUPERVISEUR: 'Supervision',
};

export const RETIRED_SUFFIX = '(retiré)';

export type PageMeta = Schemas['PageMetaDto'];

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

export const PROSPECT_SORT_FIELDS = [
  'clientCreatedAt',
  'createdAt',
  'nom',
  'prenom',
  'statut',
] as const satisfies readonly Schemas['ProspectSortField'][];

export type ProspectSortField = (typeof PROSPECT_SORT_FIELDS)[number];

export type SortDirection = Schemas['SortOrder'];

export interface ProspectFilters {
  search: string;
  commercialId: string | null;
  representantId: string | null;
  departementId: string | null;
  banqueId: string | null;
  syndicatId: string | null;
  statut: ProspectStatut | null;
  segment: BddSegment | null;
  phase2Status: Phase2Status | null;
  enrollmentMethod: EnrollmentMethod | null;
  campaignId: string | null;
  enrollmentCapturedById: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  page: number;
  pageSize: number;
  sortBy: ProspectSortField;
  sortDir: SortDirection;
}

export type BddSegment = Schemas['BddSegment'];
export type Phase2Status = Schemas['Phase2Status'];
export type EnrollmentMethod = Schemas['EnrollmentMethod'];
export type CallOutcome = Schemas['CallOutcome'];
export type CampaignScope = Schemas['CampaignScope'];
export type CampaignStatus = Schemas['CampaignStatus'];

export type CampaignSummary = Schemas['CampaignSummaryDto'];
export type CampaignDetail = Schemas['CampaignDetailDto'];
export type CampaignCommercial = Schemas['CampaignCommercialDto'];
export type CampaignAttempt = Schemas['CampaignAttemptDto'];
export type CampaignProgress = Schemas['CampaignProgressDto'];
export type CreateCampaignInput = Schemas['CreateCampaignDto'];

export const BDD_SEGMENTS = [
  'BDD1',
  'BDD2',
  'BDD3',
  'BDD4',
] as const satisfies readonly BddSegment[];

export const SEGMENT_LABELS: Record<BddSegment, string> = {
  BDD1: 'BDD1 : CHUES / CBAO',
  BDD2: 'BDD2 : CHUES / autre banque',
  BDD3: 'BDD3 : autre syndicat / CBAO',
  BDD4: 'BDD4 : autre syndicat / autre banque',
};

export const CAMPAIGN_SCOPES = [
  'ALL',
  'BDD1',
  'BDD2',
  'BDD3',
  'BDD4',
] as const satisfies readonly CampaignScope[];

export function campaignScopeLabel(scope: CampaignScope): string {
  return scope === 'ALL' ? 'Toutes bases : BDD1 à BDD4' : SEGMENT_LABELS[scope];
}

export const PHASE2_STATUSES = [
  'PENDING',
  'METHOD_OBTAINED',
  'REFUSED',
  'WRONG_NUMBER',
] as const satisfies readonly Phase2Status[];

export const PHASE2_STATUS_LABELS: Record<Phase2Status, string> = {
  PENDING: 'En attente',
  METHOD_OBTAINED: 'Méthode obtenue',
  REFUSED: 'Refus',
  WRONG_NUMBER: 'Mauvais numéro',
};

export const ENROLLMENT_METHODS = [
  'PLATFORM',
  'PHYSICAL',
  'VOICE_OR_ELECTRONIC_MESSAGING',
] as const satisfies readonly EnrollmentMethod[];

export const ENROLLMENT_METHOD_LABELS: Record<EnrollmentMethod, string> = {
  PLATFORM: 'Plateforme',
  PHYSICAL: 'Physique',
  VOICE_OR_ELECTRONIC_MESSAGING: 'Vocal ou messagerie électronique',
};

export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  METHOD_OBTAINED: 'Méthode obtenue',
  UNREACHABLE: 'Injoignable',
  CALLBACK: 'À rappeler',
  REFUSED: 'Refus',
  WRONG_NUMBER: 'Mauvais numéro',
  OTHER: 'Autre',
};

export type RepCallOutcome = Schemas['RepCallOutcome'];

export const REP_CALL_OUTCOME_LABELS: Record<RepCallOutcome, string> = {
  REACHED: 'Joint',
  PROSPECTS_PROMISED: 'Prospects promis',
  UNREACHABLE: 'Injoignable',
  CALLBACK: 'À rappeler',
  REFUSED: 'Refus',
  WRONG_NUMBER: 'Mauvais numéro',
  OTHER: 'Autre',
};

export const REP_CALL_OUTCOME_VARIANTS: Record<RepCallOutcome, BadgeVariant> = {
  REACHED: 'info',
  PROSPECTS_PROMISED: 'success',
  UNREACHABLE: 'secondary',
  CALLBACK: 'info',
  REFUSED: 'destructive',
  WRONG_NUMBER: 'warning',
  OTHER: 'outline',
};

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  ACTIVE: 'En cours',
  CLOSED: 'Clôturée',
};

type MissingFrom<Enum extends string, Listed extends string> = Exclude<Enum, Listed>;

type FilterListCoverage = {
  PROSPECT_STATUTS: MissingFrom<ProspectStatut, (typeof PROSPECT_STATUTS)[number]>;
  BDD_SEGMENTS: MissingFrom<BddSegment, (typeof BDD_SEGMENTS)[number]>;
  CAMPAIGN_SCOPES: MissingFrom<CampaignScope, (typeof CAMPAIGN_SCOPES)[number]>;
  PHASE2_STATUSES: MissingFrom<Phase2Status, (typeof PHASE2_STATUSES)[number]>;
  ENROLLMENT_METHODS: MissingFrom<EnrollmentMethod, (typeof ENROLLMENT_METHODS)[number]>;
  PROSPECT_SORT_FIELDS: MissingFrom<
    Schemas['ProspectSortField'],
    (typeof PROSPECT_SORT_FIELDS)[number]
  >;
  BANK_CASE_SORT_FIELDS: MissingFrom<BankCaseSortField, (typeof BANK_CASE_SORT_FIELDS)[number]>;
};

export const FILTER_LISTS_ARE_EXHAUSTIVE: Record<keyof FilterListCoverage, never> =
  {} as FilterListCoverage;

export type BankStageType = Schemas['BankStageType'];
export type BankCaseStage = Schemas['BankCaseStageDto'];
export type BankRejectionReason = Schemas['BankRejectionReasonDto'];
export type BankCase = Schemas['BankCaseDto'];
export type BankCaseTransition = Schemas['BankCaseTransitionDto'];
export type BankCaseDetail = Schemas['BankCaseDetailDto'];
export type BankCaseAnalytics = Schemas['BankCaseAnalyticsDto'];
export type BankProspectSearchItem = Schemas['ProspectSearchItemDto'];
export type CreateBankCaseInput = Schemas['CreateBankCaseDto'];
export type BankCaseSortField = Schemas['BankCaseSortField'];

export const BANK_CASE_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'reference',
  'customerName',
  'amountXof',
] as const satisfies readonly BankCaseSortField[];

export type BadgeVariant =
  'default' | 'secondary' | 'outline' | 'success' | 'warning' | 'destructive' | 'info';

export function stageBadgeVariant(color: string): BadgeVariant {
  switch (color) {
    case 'success':
      return 'success';
    case 'warning':
    case 'accent':
      return 'warning';
    case 'destructive':
    case 'danger':
      return 'destructive';
    case 'info':
      return 'info';
    case 'primary':
      return 'default';
    default:
      return 'secondary';
  }
}

export const BANK_STAGE_TYPE_LABELS: Record<BankStageType, string> = {
  OPEN: 'En cours',
  CASHED: 'Encaissé',
  REJECTED: 'Rejeté',
};

export type DemoStatus = Schemas['DemoStatusDto'];
export type DemoCounts = Schemas['DemoCountsDto'];

export type DashboardKpis = Schemas['AnalyticsTotalsDto'];

export interface TimeSeriePoint {
  date: string;
  count: number;
  cumulative: number;
}

export interface NamedCount {
  id: string;
  label: string;
  value: number;
}

export interface DashboardStats {
  kpis: DashboardKpis;
  prospectsOverTime: TimeSeriePoint[];
  topCommerciaux: NamedCount[];
  parDepartement: NamedCount[];
  parBanque: NamedCount[];
  parSyndicat: NamedCount[];
  topRepresentants: NamedCount[];
}

export interface FilterOption {
  value: string;
  label: string;
  hint?: string | undefined;
}

export interface ReferenceData {
  departements: Departement[];
  iefs: Ief[];
  banques: Banque[];
  syndicats: Syndicat[];
  regions: Region[];
  commerciaux: FilterOption[];
  representants: FilterOption[];
  campagnes: FilterOption[];
}
