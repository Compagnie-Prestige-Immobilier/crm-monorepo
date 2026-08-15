import type { components } from '@crm/api-client';

/**
 * Types du domaine CPI GO.
 *
 * Ils ne sont plus écrits à la main : chaque entité est un alias du DTO généré
 * depuis `apps/api/openapi.json`. Le contrat change, `pnpm codegen` régénère,
 * et le `typecheck` du panel casse à l'endroit exact où l'écran ment. C'est le
 * seul dispositif qui empêche une colonne d'afficher un champ que l'API ne
 * renvoie plus.
 *
 * Ne subsistent en propre que les formes qui n'existent QUE dans le panel : le
 * DTO de filtre (sérialisé dans l'URL), la pagination aplatie et les
 * agrégations du tableau de bord, recomposées à partir de six endpoints.
 */

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

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * `as const satisfies`, et jamais `readonly X[]`, sur TOUTES ces listes.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Ces tableaux alimentent les listes déroulantes de filtre. Annotés
 * `readonly ProspectStatut[]`, ils acceptent un SOUS-ENSEMBLE sans broncher :
 * un statut ajouté au contrat disparaît silencieusement des filtres, et
 * personne ne peut plus retrouver les fiches qui le portent. Les tables de
 * libellés voisines (`Record<ProspectStatut, string>`), elles, cassent le
 * build : deux façons d'écrire la même chose, dont une seule protège.
 *
 * `as const satisfies readonly ProspectStatut[]` garde la vérification (aucune
 * valeur inventée) ET conserve le type littéral, ce qui permet à
 * `EXHAUSTIVE_*` ci-dessous d'exiger la couverture complète. C'est déjà ce que
 * fait `PROSPECT_SORT_FIELDS` : la règle est simplement appliquée partout.
 */
export const PROSPECT_STATUTS = [
  'NOUVEAU',
  'CONTACTE',
  'CONVERTI',
  'PERDU',
] as const satisfies readonly ProspectStatut[];

/** Libellés métier français. Les enums Prisma ne s'affichent jamais bruts. */
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
};

/**
 * Valeur affichée pour un référentiel désactivé.
 *
 * Désactiver une banque ne supprime AUCUN prospect : les fiches gardent la
 * référence, et c'est voulu : un export d'octobre doit rester lisible en
 * janvier. L'écran doit donc distinguer « la banque X » de « la banque X,
 * retirée du référentiel », sinon l'administrateur croit à une donnée perdue.
 */
export const RETIRED_SUFFIX = '(retiré)';

// ─── Pagination ─────────────────────────────────────────────────────────────

export type PageMeta = Schemas['PageMetaDto'];

/**
 * Pagination aplatie. L'API renvoie `{ items, meta }` ; les tableaux du panel
 * lisent `total`/`page`/`pageCount` directement, et une indirection de plus
 * n'apporterait rien.
 */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

// ─── DTO de filtre ──────────────────────────────────────────────────────────

/**
 * Champs de tri RÉELLEMENT supportés par `GET /prospects`. La liste vient du
 * contrat (`ProspectSortField`) : proposer un tri « par représentant » que
 * l'API ignore afficherait une flèche qui ne trie rien.
 */
export const PROSPECT_SORT_FIELDS = [
  'clientCreatedAt',
  'createdAt',
  'nom',
  'prenom',
  'statut',
] as const satisfies readonly Schemas['ProspectSortField'][];

export type ProspectSortField = (typeof PROSPECT_SORT_FIELDS)[number];

export type SortDirection = Schemas['SortOrder'];

/**
 * Objet de filtre unique. Il pilote LES TROIS consommateurs : le tableau, les
 * graphiques et l'export : pour qu'un lien collé dans un chat rende exactement
 * le même écran, et que le fichier Excel corresponde à ce qui est à l'écran.
 * Sérialisé tel quel dans les search params de l'URL (voir `lib/filters.ts`).
 */
export interface ProspectFilters {
  search: string;
  commercialId: string | null;
  representantId: string | null;
  departementId: string | null;
  banqueId: string | null;
  syndicatId: string | null;
  statut: ProspectStatut | null;
  /** Segment BDD1–BDD4, calculé par l'API (syndicat × banque). */
  segment: BddSegment | null;
  phase2Status: Phase2Status | null;
  enrollmentMethod: EnrollmentMethod | null;
  /** Prospects tirés dans cette campagne d'appels. */
  campaignId: string | null;
  /** Commercial qui a OBTENU la méthode, distinct du propriétaire de phase 1. */
  enrollmentCapturedById: string | null;
  /** Bornes incluses, format ISO `YYYY-MM-DD`, sur `clientCreatedAt`. */
  dateFrom: string | null;
  dateTo: string | null;
  page: number;
  pageSize: number;
  sortBy: ProspectSortField;
  sortDir: SortDirection;
}

// ─── Phase 2 ────────────────────────────────────────────────────────────────

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

/**
 * Libellés de segment, repris MOT POUR MOT de `packages/database/src/segment.ts`
 * (`SEGMENT_LABELS`). Les onglets du classeur consolidé et les axes des
 * graphiques portent les mêmes : un « BDD1 » nommé autrement à l'écran qu'à
 * l'export se lit comme deux populations différentes.
 */
export const SEGMENT_LABELS: Record<BddSegment, string> = {
  BDD1: 'BDD1 : CHUES / CBAO',
  BDD2: 'BDD2 : CHUES / autre banque',
  BDD3: 'BDD3 : autre syndicat / CBAO',
  BDD4: 'BDD4 : autre syndicat / autre banque',
};

/** Version courte, pour une cellule de tableau où le libellé complet déborde. */
export const SEGMENT_SHORT_LABELS: Record<BddSegment, string> = {
  BDD1: 'BDD1',
  BDD2: 'BDD2',
  BDD3: 'BDD3',
  BDD4: 'BDD4',
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

// ─── Campagnes REPRÉSENTANTS ────────────────────────────────────────────────

export type RepCallOutcome = Schemas['RepCallOutcome'];

/**
 * Libellés des issues d'appel aux représentants.
 *
 * Le détail d'une campagne représentants affichait l'énumération BRUTE :
 * l'écran montrait littéralement « PROSPECTS_PROMISED » à un administrateur.
 * Son jumeau, le détail des campagnes prospects, traduit depuis toujours par
 * `CALL_OUTCOME_LABELS` : les deux écrans se lisent côte à côte, et l'un
 * parlait français quand l'autre parlait Prisma.
 *
 * L'issue est propre à ce module et ne recoupe PAS `CallOutcome` : appeler un
 * représentant, c'est obtenir la promesse d'une liste de prospects, pas une
 * méthode d'enrôlement. Deux énumérations, deux tables de libellés.
 */
export const REP_CALL_OUTCOME_LABELS: Record<RepCallOutcome, string> = {
  REACHED: 'Joint',
  PROSPECTS_PROMISED: 'Prospects promis',
  UNREACHABLE: 'Injoignable',
  CALLBACK: 'À rappeler',
  REFUSED: 'Refus',
  WRONG_NUMBER: 'Mauvais numéro',
  OTHER: 'Autre',
};

/** Même code couleur que les campagnes prospects : deux écrans, une grammaire. */
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

// ─── Exhaustivité des listes de filtre ──────────────────────────────────────

/**
 * Ce qui MANQUE à une liste pour couvrir toute son énumération.
 *
 * `as const satisfies readonly X[]` interdit d'INVENTER une valeur, mais pas
 * d'en OUBLIER une : `['NOUVEAU'] satisfies readonly ProspectStatut[]` compile
 * parfaitement. Or c'est l'oubli qui fait mal : un membre ajouté au contrat
 * disparaît de la liste déroulante, et les fiches qui le portent deviennent
 * introuvables sans qu'aucun écran ne l'explique.
 */
type MissingFrom<Enum extends string, Listed extends string> = Exclude<Enum, Listed>;

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Le garde-fou : toutes les entrées doivent valoir `never`.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Un membre oublié transforme son entrée en chaîne littérale, et cette
 * affectation cesse de compiler EN LE NOMMANT. C'est ce que font déjà, par
 * construction, les tables `Record<Enum, string>` voisines ; les listes
 * n'avaient, elles, aucune protection équivalente.
 *
 * Aucun coût à l'exécution qui vaille d'être mentionné : un objet vide.
 */
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

// ─── Banque & Finance ───────────────────────────────────────────────────────

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

/**
 * Le `color` d'une étape est un RÔLE du design system (`info`, `warning`,
 * `success`, `destructive`…), jamais un hex : c'est écrit dans le contrat
 * (`BankCaseStageDto.color`). On le traduit ici en variante de `Badge`, avec un
 * repli neutre : une étape créée demain avec un rôle inconnu doit s'afficher,
 * pas casser l'écran.
 */
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

// ─── Mode démonstration ─────────────────────────────────────────────────────

export type DemoStatus = Schemas['DemoStatusDto'];
export type DemoCounts = Schemas['DemoCountsDto'];

// ─── Tableau de bord ────────────────────────────────────────────────────────

/**
 * Indicateurs de tête. Repris tels quels de `GET /analytics/totals` : le panel
 * ne recalcule rien, sinon deux écrans finissent par afficher deux totaux.
 */
export type DashboardKpis = Schemas['AnalyticsTotalsDto'];

export interface TimeSeriePoint {
  /** `YYYY-MM-DD`. */
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

// ─── Options de filtre (combobox) ───────────────────────────────────────────

export interface FilterOption {
  value: string;
  label: string;
  /** Deuxième ligne dans la liste : département, sigle, secteur… */
  hint?: string | undefined;
}

export interface ReferenceData {
  departements: Departement[];
  /** Les IEF : découpage scolaire. 59 pour 46 départements. */
  iefs: Ief[];
  banques: Banque[];
  syndicats: Syndicat[];
  regions: Region[];
  commerciaux: FilterOption[];
  representants: FilterOption[];
  campagnes: FilterOption[];
}
