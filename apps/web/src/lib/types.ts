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
export type Employeur = Schemas['EmployeurDto'];
export type EmployeurType = Schemas['EmployeurType'];
export type Pays = Schemas['PaysDto'];
export type TypeContrat = Schemas['TypeContrat'];
export type ModeEpargne = Schemas['ModeEpargne'];

export const EMPLOYEUR_TYPE_LABELS: Record<EmployeurType, string> = {
  MINISTERE: 'Ministère',
  ENTREPRISE: 'Entreprise',
  AUTRE: 'Autre',
};

export const TYPE_CONTRAT_LABELS: Record<TypeContrat, string> = {
  CDI: 'CDI',
  CDD: 'CDD',
  AUTRE: 'Autre',
};

export const MODE_EPARGNE_LABELS: Record<ModeEpargne, string> = {
  TONTINE: 'Tontine',
  MOBILE_MONEY: 'Mobile money',
  BANQUE: 'Banque',
  AUCUN: 'Aucune',
};

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  COMPTANT: 'Comptant',
  ECHELONNE: 'Échelonné',
};

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
  CHARGE_CLIENTELE: 'Chargé de clientèle',
};

/**
 * Les rôles qui LISENT le travail des autres sans jamais y écrire. Les écrans
 * partagés s'en servent pour retirer les gestes, l'API refusant de toute façon.
 */
export const readsOnly = (role: Role | undefined): boolean =>
  role === 'SUPERVISEUR' || role === 'DIRECTION';

/**
 * L'export des prospects n'est pas un geste d'écriture : la DIRECTION y a droit
 * côté API (`@Roles(ADMIN, COMMERCIAL, DIRECTION)`), l'écran le lui laisse.
 */
export const canExportProspects = (role: Role | undefined): boolean =>
  role === 'ADMIN' || role === 'COMMERCIAL' || role === 'CHARGE_CLIENTELE' || role === 'DIRECTION';

/**
 * Miroir de `PARCOURS_ROLES` côté API : les seuls rôles qui peuvent ouvrir une
 * fiche, donc les seuls à qui la barre supérieure a une ouverture à demander.
 */
export const peutTenirUneFiche = (role: Role | undefined): boolean =>
  role === 'ADMIN' ||
  role === 'COMMERCIAL' ||
  role === 'CHARGE_CLIENTELE' ||
  role === 'SUPERVISEUR' ||
  role === 'DIRECTION';

/** Miroir de `@Roles` sur `GET /export/representants.xlsx`. */
export const canExportRepresentants = (role: Role | undefined): boolean =>
  role === 'ADMIN' ||
  role === 'COMMERCIAL' ||
  role === 'CHARGE_CLIENTELE' ||
  role === 'SUPERVISEUR' ||
  role === 'DIRECTION';

/** Qui marque une demande convertie « revue ». Miroir de `POST /prospects/{id}/revue`. */
export const peutRevoirUneDemande = (role: Role | undefined): boolean =>
  role === 'ADMIN' || role === 'CHARGE_CLIENTELE' || role === 'SUPERVISEUR';

export const RETIRED_SUFFIX = '(retiré)';

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
  'lastCallAt',
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
  enrollmentCapturedById: string | null;
  /** Revue du closing : `false` isole les demandes converties qui restent à revoir. */
  revue: boolean | null;
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
  'WHATSAPP',
] as const satisfies readonly EnrollmentMethod[];

/** Ce que l'écran propose. `PHYSICAL` en sort : EB-24 l'a versé dans « RDV CPI ». */
export const ENROLLMENT_METHOD_ORDER = [
  'APPOINTMENT',
  'PLATFORM',
  'VOICE_OR_ELECTRONIC_MESSAGING',
  'WHATSAPP',
] as const satisfies readonly EnrollmentMethod[];

export const ENROLLMENT_METHOD_LABELS: Record<EnrollmentMethod, string> = {
  APPOINTMENT: 'RDV CPI',
  PHYSICAL: 'RDV CPI',
  PLATFORM: 'Plateforme en ligne',
  PLATEFORME_EN_LIGNE: 'Plateforme en ligne',
  VOICE_OR_ELECTRONIC_MESSAGING: 'Mail',
  MAIL: 'Mail',
  WHATSAPP: 'WhatsApp',
  RDV_CPI: 'RDV CPI',
};

export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  METHOD_OBTAINED: 'Méthode obtenue',
  UNREACHABLE: 'Injoignable',
  CALLBACK: 'À rappeler',
  REFUSED: 'Refus',
  WRONG_NUMBER: 'Mauvais numéro',
  OTHER: 'Autre',
};

export const CALL_OUTCOME_VARIANTS: Record<CallOutcome, BadgeVariant> = {
  METHOD_OBTAINED: 'success',
  UNREACHABLE: 'secondary',
  CALLBACK: 'info',
  REFUSED: 'destructive',
  WRONG_NUMBER: 'warning',
  OTHER: 'outline',
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

type MissingFrom<Enum extends string, Listed extends string> = Exclude<Enum, Listed>;

type FilterListCoverage = {
  PROSPECT_STATUTS: MissingFrom<ProspectStatut, (typeof PROSPECT_STATUTS)[number]>;
  BDD_SEGMENTS: MissingFrom<BddSegment, (typeof BDD_SEGMENTS)[number]>;
  PHASE2_STATUSES: MissingFrom<Phase2Status, (typeof PHASE2_STATUSES)[number]>;
  ENROLLMENT_METHODS: MissingFrom<
    Exclude<EnrollmentMethod, 'RDV_CPI' | 'PLATEFORME_EN_LIGNE' | 'MAIL'>,
    (typeof ENROLLMENT_METHODS)[number]
  >;
  PROSPECT_SORT_FIELDS: MissingFrom<
    Schemas['ProspectSortField'],
    (typeof PROSPECT_SORT_FIELDS)[number]
  >;
  BANK_CASE_SORT_FIELDS: MissingFrom<BankCaseSortField, (typeof BANK_CASE_SORT_FIELDS)[number]>;
};

void ({} as FilterListCoverage satisfies Record<keyof FilterListCoverage, never>);

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

export interface NamedCount {
  id: string;
  label: string;
  value: number;
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
  employeurs: Employeur[];
  pays: Pays[];
  regions: Region[];
  commerciaux: FilterOption[];
  representants: FilterOption[];
}
