import type { components, operations } from '@crm/api-client';

type Schemas = components['schemas'];

export type Role = Schemas['CompteConnecte']['role'];
export type ProspectStatut = Schemas['Prospect']['statut'];
export type ProspectType = NonNullable<Schemas['Prospect']['type']>;
export type TypeBien = NonNullable<Schemas['Prospect']['typeBien']>;
export type PaymentMode = NonNullable<Schemas['Prospect']['paymentMode']>;

/** Un même item générique porte tous les référentiels côté Go (`ReferentielsItem`). */
type ReferentielItem = Schemas['ReferentielsItem'];
export type Region = ReferentielItem;
export type Departement = ReferentielItem;
export type Ief = ReferentielItem;
export type Banque = ReferentielItem;
export type Syndicat = ReferentielItem;
export type Profession = ReferentielItem;
export type IncomeBand = ReferentielItem;
export type Offer = ReferentielItem;
export type Employeur = ReferentielItem;
export type EmployeurType = Exclude<Schemas['ReferentielsEntree']['type'], undefined>;
export type Pays = ReferentielItem;
export type TypeContrat = NonNullable<Schemas['Prospect']['typeContrat']>;
export type ModeEpargne = NonNullable<Schemas['Prospect']['modeEpargne']>;

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

export const PAYMENT_MODES = [
  'COMPTANT',
  'ECHELONNE',
  'CREDIT_IMMOBILIER',
] as const satisfies readonly PaymentMode[];

export const PAYMENT_MODE_LABELS: Record<PaymentMode, string> = {
  COMPTANT: 'Comptant',
  ECHELONNE: 'Échelonné',
  CREDIT_IMMOBILIER: 'Crédit immobilier',
};

export const TYPES_BIEN = ['TERRAIN', 'VILLA'] as const satisfies readonly TypeBien[];

export const TYPE_BIEN_LABELS: Record<TypeBien, string> = {
  TERRAIN: 'Terrain',
  VILLA: 'Villa',
};

export type SessionUser = Schemas['CompteConnecte'];
export type UserRow = Schemas['Compte'];
export type RepresentantRow = Schemas['RepresentantDto'];
export type ProspectRow = Schemas['Prospect'];

export type CreateUserInput = Schemas['CreerCompteInputBody'];
export type UpdateUserInput = Schemas['ModifierCompteInputBody'];
export type UpdateProspectInput = Schemas['ProspectBody'];
export type UpdateRepresentantInput = Schemas['RepresentantUpdateInputBody'];

/** Borne du serveur (`attempt-rules.ts`) : la conversion et le formulaire public la partagent. */
export const DUREE_ETABLISSEMENT_MAX_MOIS = 600;

export const PROSPECT_STATUTS = [
  'NOUVEAU',
  'CONTACTE',
  'CONVERTI',
  'VENDU',
  'PERDU',
] as const satisfies readonly ProspectStatut[];

/**
 * Ce que la fiche accepte en écriture directe (création, édition). `VENDU` ne
 * s'atteint que par l'action dédiée « Marquer vendu » : le serveur le refuse
 * ailleurs, ce sous-ensemble évite d'offrir un choix qu'il rejette.
 */
export const PROSPECT_STATUTS_MODIFIABLES = [
  'NOUVEAU',
  'CONTACTE',
  'CONVERTI',
  'PERDU',
] as const satisfies readonly ProspectStatut[];

export const PROSPECT_STATUT_LABELS: Record<ProspectStatut, string> = {
  NOUVEAU: 'Nouveau',
  CONTACTE: 'Contacté',
  CONVERTI: 'Converti',
  VENDU: 'Vendu',
  PERDU: 'Perdu',
};

export type Projet = Schemas['Prospect']['projet'];

/**
 * Le statut du PARCOURS demandé, et non celui du point d'entrée.
 *
 * L'API classe sur `journeys.some({ projet, statut })` : une fiche entrée par
 * CHUES puis convertie en Grand Public reste « Nouveau » en premier niveau,
 * alors qu'elle remonte dans une liste filtrée sur « Converti ». Sans parcours
 * pour ce projet, fiche d'avant les parcours, le champ de premier niveau est
 * la seule réponse disponible.
 */
export function statutForProjet(prospect: ProspectRow, projet: Projet | null): ProspectStatut {
  if (projet === null) return prospect.statut;
  return prospect.journeys.find((journey) => journey.projet === projet)?.statut ?? prospect.statut;
}

/** Catalogue fermé, tenu égal à `internal/shared/socle/permissions.go` par un test d'intégration. */
export const PERMISSIONS = [
  'accueil.listes',
  'accueil.registre',
  'analytics.superviser',
  'assistant.tout_lire',
  'assistant.utiliser',
  'banque.administrer',
  'banque.dossiers',
  'banque.lire',
  'banque.voir_tous_portefeuilles',
  'bases.administrer',
  'campagnes.administrer',
  'campagnes.attributions_toutes',
  'campagnes.gerer',
  'campagnes.superviser',
  'chiffres.disposer',
  'chiffres.voir_montants',
  'comptes.administrer',
  'comptes.lister',
  'courriels.administrer',
  'donnees.voir_supprimees',
  'enrolement.administrer',
  'exploitation.administrer',
  'exports.banque',
  'exports.globaux',
  'exports.modeles',
  'exports.prospects',
  'exports.voir_tout',
  'fiches.consigner_attribuees',
  'fiches.forcer_transition',
  'fiches.ignorer_propriete',
  'fiches.modifier_toutes',
  'fiches.ouvrir_attribuees',
  'fiches.parametres_reserves',
  'fiches.tenir',
  'fiches.voir_converties',
  'formulaires.administrer',
  'imports.administrer',
  'notifications.administrer',
  'panneau.acceder',
  'parametres.administrer',
  'portefeuille.voir_tout',
  'prospects.convertir',
  'prospects.fusionner',
  'prospects.lire',
  'prospects.reaffecter',
  'prospects.reaffecter_tout',
  'prospects.revoir',
  'prospects.superviser',
  'qualification.rappels',
  'referentiels.superviser',
  'rendez_vous.suivre',
  'rendez_vous.exporter',
  'rendez_vous.voir',
  'roles.administrer',
  'support.plateforme',
  'support.signaler',
  'ventes.gerer',
  'ventes.lire',
  'visites.detruire',
  'visites.voir_archivees',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const peut = (
  user: Pick<SessionUser, 'permissions'> | null | undefined,
  permission: Permission,
): boolean => user?.permissions.includes(permission) ?? false;

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
export const peutTenirUneFiche = (
  user: Pick<SessionUser, 'permissions'> | null | undefined,
): boolean => peut(user, 'fiches.tenir');

/** Miroir de `@Roles` sur `GET /export/representants.xlsx`. */
export const canExportRepresentants = (role: Role | undefined): boolean =>
  role === 'ADMIN' ||
  role === 'COMMERCIAL' ||
  role === 'CHARGE_CLIENTELE' ||
  role === 'SUPERVISEUR' ||
  role === 'DIRECTION';

/** Qui marque une demande convertie « revue ». Miroir de `POST /prospects/{id}/revue`. */
export const peutRevoirUneDemande = (
  user: Pick<SessionUser, 'permissions'> | null | undefined,
): boolean => peut(user, 'prospects.revoir');

export const RETIRED_SUFFIX = '(retiré)';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}

type ListeProspectsQuery = NonNullable<operations['listProspects']['parameters']['query']>;

export const PROSPECT_SORT_FIELDS = [
  'clientCreatedAt',
  'createdAt',
  'nom',
  'prenom',
  'statut',
  'lastCallAt',
] as const satisfies readonly ListeProspectsQuery['sortBy'][];

export type ProspectSortField = (typeof PROSPECT_SORT_FIELDS)[number];

export type SortDirection = Exclude<ListeProspectsQuery['sortOrder'], undefined>;

export interface ProspectFilters {
  projet: Projet | null;
  search: string;
  commercialId: string | null;
  representantId: string | null;
  departementId: string | null;
  banqueId: string | null;
  syndicatId: string | null;
  statut: ProspectStatut | null;
  segment: BddSegment | null;
  /** `TOUT` régroupe Intéressés, Hésitants et Rendez-vous : ce n'est pas un statut réel. */
  phase2Status: Phase2Status | 'TOUT' | null;
  /** Code du motif dont le dernier appel écarte la fiche de la liste. */
  sansMotif: string | null;
  /** Code du statut de qualification du dernier appel. */
  motif: string | null;
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

export type BddSegment = NonNullable<Schemas['Prospect']['segment']>;
export type Phase2Status = Schemas['Prospect']['phase2Status'];
export type EnrollmentMethod = Exclude<ListeProspectsQuery['enrollmentMethod'], undefined>;
export const BDD_SEGMENTS = [
  'BDD1',
  'BDD2',
  'BDD3',
  'BDD4',
] as const satisfies readonly BddSegment[];

export const SEGMENT_LABELS: Record<BddSegment, string> = {
  BDD1: 'CHUES, CBAO',
  BDD2: 'CHUES, autre banque',
  BDD3: 'Autre syndicat, CBAO',
  BDD4: 'Autre syndicat, autre banque',
};

export const PHASE2_STATUSES = [
  'PENDING',
  'METHOD_OBTAINED',
  'INTERESTED',
  'HESITANT',
  'APPOINTMENT',
  'REACHED',
  'REFUSED',
  'UNREACHABLE',
  'WRONG_NUMBER',
] as const satisfies readonly Phase2Status[];

export const PHASE2_STATUS_LABELS: Record<Phase2Status, string> = {
  PENDING: 'En attente',
  METHOD_OBTAINED: 'Méthode obtenue',
  INTERESTED: 'Intéressé',
  HESITANT: 'Hésitant',
  APPOINTMENT: 'Rendez-vous',
  REACHED: 'Joint, sans suite',
  REFUSED: 'Refus',
  UNREACHABLE: 'Injoignable',
  WRONG_NUMBER: 'Faux numéro',
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
  APPOINTMENT: 'Enrôlement sur place',
  PHYSICAL: 'Enrôlement sur place',
  PLATFORM: 'Plateforme en ligne',
  PLATEFORME_EN_LIGNE: 'Plateforme en ligne',
  VOICE_OR_ELECTRONIC_MESSAGING: 'Par e-mail',
  MAIL: 'Par e-mail',
  WHATSAPP: 'Par WhatsApp',
  RDV_CPI: 'Enrôlement sur place',
};

/**
 * `Prospect.enrollmentMethod` voyage en `string` côté Go, pas en énum : une
 * tentative plus ancienne qu'un retrait de méthode garde une valeur que le
 * catalogue actuel ignore.
 */
export const enrollmentMethodLabel = (method: string): string =>
  ENROLLMENT_METHOD_LABELS[method as EnrollmentMethod] ?? method;

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
    Exclude<ListeProspectsQuery['sortBy'], undefined>,
    (typeof PROSPECT_SORT_FIELDS)[number]
  >;
  BANK_CASE_SORT_FIELDS: MissingFrom<BankCaseSortField, (typeof BANK_CASE_SORT_FIELDS)[number]>;
};

void ({} as FilterListCoverage satisfies Record<keyof FilterListCoverage, never>);

type ListeDossiersQuery = NonNullable<operations['get-api-v1-bank-cases']['parameters']['query']>;

export type BankStageType = Schemas['EtapeBanque']['type'];
export type BankCaseStage = Schemas['EtapeBanque'];
export type BankRejectionReason = Schemas['MotifBanque'];
export type BankCase = Schemas['DossierBanque'];
export type BankCaseTransition = Schemas['TransitionBanque'];
export type BankCaseDetail = Schemas['DetailDossierOutputBody'];
export type BankCaseAnalytics = Schemas['IndicateursBanqueOutputBody'];
export type BankProspectSearchItem = Schemas['ProspectBanque'];
export type CreateBankCaseInput = Schemas['CreationDossierInputBody'];
export type InscriptionAOuvrir = Schemas['InscriptionAOuvrir'];
export type PilotageBanque = Schemas['PilotageBanque'];
export type Courriel = Schemas['CourrielDTO'];
export type ReglagesCourriels = Schemas['ReglagesCourriels'];
export type BankCaseSortField = Exclude<ListeDossiersQuery['sortBy'], undefined>;

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

/**
 * Relevé du journal d'appels du téléphone. Absent du contrat Go : venait de
 * l'application mobile, abandonnée le 8 septembre 2026 ; `fetchProspectDeviceCalls`
 * et `fetchRepresentantDeviceCalls` rendent toujours une liste vide.
 */
export interface DeviceCallDetection {
  id: string;
  performedById: string;
  performedByName: string;
  deviceCallType:
    'sortant' | 'entrant' | 'manque' | 'rejete' | 'bloque' | 'messagerie' | 'externe' | 'inconnu';
  deviceCallDurationSeconds: number;
  deviceCallAt: string;
  detectedAt: string;
  attemptId: string | null;
}

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
  /** Une fiche n'est pas creee que par un teleconseiller : le filtre les porte tous. */
  utilisateurs: FilterOption[];
  representants: FilterOption[];
}
