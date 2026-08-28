import type { components } from '@crm/api-client';

type Schemas = components['schemas'];

export type Role = Schemas['Role'];
export type ProspectStatut = Schemas['ProspectStatut'];
export type ProspectType = Schemas['ProspectType'];
export type PaymentMode = Schemas['PaymentMode'];

export type Region = Schemas['RegionDto'];
export type Departement = Schemas['DepartementDto'];
export type Ief = Schemas['IefDto'];
export type Banque = Schemas['BanqueDto'];
export type Syndicat = Schemas['SyndicatDto'];
export type Profession = Schemas['ProfessionDto'];
export type IncomeBand = Schemas['IncomeBandDto'];
export type Offer = Schemas['OfferDto'];

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

export type Projet = Schemas['Projet'];

/**
 * Le statut du PARCOURS demandé, et non celui du point d'entrée.
 *
 * L'API classe sur `journeys.some({ projet, statut })` : une fiche entrée par
 * CHUES puis convertie en Grand Public reste « Nouveau » en premier niveau,
 * alors qu'elle remonte dans une liste filtrée sur « Converti ». Sans parcours
 * pour ce projet — fiche d'avant les parcours — le champ de premier niveau est
 * la seule réponse disponible.
 */
export function statutForProjet(prospect: ProspectRow, projet: Projet | null): ProspectStatut {
  if (projet === null) return prospect.statut;
  return prospect.journeys.find((journey) => journey.projet === projet)?.statut ?? prospect.statut;
}

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Administrateur',
  COMMERCIAL: 'Téléconseiller',
  BANQUE_FINANCE: 'Banque & Finance',
  SUPERVISEUR: 'Supervision',
  DIRECTION: 'Direction',
  ACCUEIL: 'Accueil',
};

/**
 * Les rôles qui LISENT le travail des autres sans jamais y écrire. Les écrans
 * partagés s'en servent pour retirer les gestes, l'API refusant de toute façon.
 */
export const readsOnly = (role: Role | undefined): boolean =>
  role === 'SUPERVISEUR' || role === 'DIRECTION';

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
  projet: Schemas['Projet'] | null;
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
  'GP1',
  'GP2',
  'GP3',
  'GP4',
] as const satisfies readonly CampaignScope[];

export function campaignScopeLabel(scope: CampaignScope): string {
  const labels: Record<CampaignScope, string> = {
    ALL: 'Tous les groupes',
    ...SEGMENT_LABELS,
    GP1: 'GP1 : Fonctionnaire',
    GP2: 'GP2 : Secteur privé',
    GP3: 'GP3 : Informel',
    GP4: 'GP4 : Diaspora',
  };
  return labels[scope];
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
  'APPOINTMENT',
] as const satisfies readonly EnrollmentMethod[];

export const ENROLLMENT_METHOD_LABELS: Record<EnrollmentMethod, string> = {
  PLATFORM: 'Plateforme',
  PHYSICAL: 'Physique',
  VOICE_OR_ELECTRONIC_MESSAGING: 'Vocal ou messagerie électronique',
  APPOINTMENT: 'Prise de rendez-vous',
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
  DRAFT: 'Brouillon',
  ACTIVE: 'En cours',
  PAUSED: 'Suspendue',
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

export type DemoStatus = Schemas['DemoWorkspaceStatusDto'];
export type DemoCounts = Schemas['DemoWorkspaceCountsDto'];

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
  professions: Profession[];
  incomeBands: IncomeBand[];
  offers: Offer[];
  regions: Region[];
  commerciaux: FilterOption[];
  representants: FilterOption[];
  campagnes: FilterOption[];
}
