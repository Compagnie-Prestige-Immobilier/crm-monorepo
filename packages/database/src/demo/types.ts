/**
 * Formes du jeu de données de démonstration.
 *
 * Deux règles gouvernent ces interfaces et expliquent presque tous les choix
 * qui suivent :
 *
 * 1. RÉFÉRENCE PAR CLÉ NATURELLE. Aucun identifiant de base n'apparaît ici.
 *    Les référentiels sont désignés par la clé stable et lisible qui porte le
 *    sens métier : `Banque.shortName`, `Syndicat.sigle`, `Departement.code`,
 *    `BankCaseStage.code`, `BankRejectionReason.code`. Les identifiants sont
 *    générés et diffèrent d'un environnement à l'autre : un jeu de données qui
 *    en contiendrait ne serait semable que sur la base où il a été écrit.
 *
 * 2. DATES RELATIVES. Tout horodatage est un `daysAgo`, un nombre de jours
 *    avant l'instant du semis. Des dates absolues vieilliraient : au bout d'un
 *    an, le graphique « prospects dans le temps » serait vide et la démo
 *    montrerait une plateforme à l'abandon. Le semeur convertit ces décalages
 *    en dates au moment où il écrit.
 *
 * Les champs `key` sont des clés LOCALES au jeu de données. Elles servent
 * uniquement à relier les entités entre elles ici (un prospect pointe vers son
 * représentant par `representantKey`) ; elles ne sont jamais persistées.
 */
import type {
  CallOutcome,
  CallTaskStatus,
  CampaignScope,
  CampaignStatus,
  EnrollmentMethod,
  Phase2Status,
  ProspectStatut,
  Role,
} from '@prisma/client';

export interface DemoUser {
  /** Clé locale, référencée par `createdByKey`, `assignedToKey`, etc. */
  key: string;
  email: string;
  username: string;
  fullName: string;
  /**
   * Mot de passe EN CLAIR. Le jeu de données est une description pure : il ne
   * peut pas hacher lui-même sans devenir asynchrone et dépendre d'argon2. Le
   * semeur le hache avec les mêmes paramètres que la vérification à la
   * connexion.
   */
  password: string;
  role: Role;
  phoneE164: string;
  /** `Departement.code` : clé naturelle, jamais l'identifiant. */
  departementCode: string | null;
  lastLoginDaysAgo: number | null;
}

export interface DemoRepresentant {
  key: string;
  fullName: string;
  phoneE164: string;
  /** `Departement.code`. */
  departementCode: string;
  createdByKey: string;
  notes: string | null;
  /** Saisie terrain (`clientCreatedAt`), pas l'arrivée en base. */
  daysAgo: number;
}

export interface DemoProspect {
  key: string;
  prenom: string;
  nom: string;
  /** `Syndicat.sigle` : premier axe du segment BDD. */
  syndicatSigle: string;
  /** `Banque.shortName` : second axe du segment BDD. */
  banqueShortName: string;
  phoneE164: string;
  representantKey: string;
  /**
   * Le commercial propriétaire de la fiche. Dérivé du représentant : sur le
   * terrain, celui qui enrôle un représentant saisit aussi ses prospects.
   */
  createdByKey: string;
  statut: ProspectStatut;
  phase2Status: Phase2Status;
  /**
   * Renseignée SI ET SEULEMENT SI `phase2Status = METHOD_OBTAINED`
   * (contrainte CHECK `prospects_enrollment_method_matches_status`).
   */
  enrollmentMethod: EnrollmentMethod | null;
  /** Toujours ≤ `daysAgo` : on ne capture pas une méthode avant la saisie. */
  enrollmentDaysAgo: number | null;
  daysAgo: number;
}

export interface DemoCallAttempt {
  key: string;
  prospectKey: string;
  /** Le commercial qui a RÉELLEMENT appelé, pas toujours l'assigné. */
  performedByKey: string;
  outcome: CallOutcome;
  /** Présente ssi `outcome = METHOD_OBTAINED` (contrainte CHECK). */
  method: EnrollmentMethod | null;
  /** OBLIGATOIRE quand `outcome = OTHER` (contrainte CHECK). */
  comment: string | null;
  daysAgo: number;
}

export interface DemoCallTask {
  key: string;
  prospectKey: string;
  assignedToKey: string;
  /** Rang dans le programme papier du commercial, à partir de 1. */
  position: number;
  status: CallTaskStatus;
  /** Porte l'index unique partiel « une seule tâche active par prospect ». */
  isActive: boolean;
  completedDaysAgo: number | null;
  attempts: DemoCallAttempt[];
}

export interface DemoCampaign {
  key: string;
  name: string;
  scope: CampaignScope;
  seed: string;
  status: CampaignStatus;
  createdByKey: string;
  daysAgo: number;
  closedDaysAgo: number | null;
  /** Ordre du round-robin : l'index vaut `position` dans la campagne. */
  commerciauxKeys: string[];
  tasks: DemoCallTask[];
}

export interface DemoBankCaseTransition {
  /** `BankCaseStage.code`, `null` à la création du dossier. */
  fromStageCode: string | null;
  toStageCode: string;
  performedByKey: string;
  /** Montant en XOF, en CHAÎNE : un entier JSON perdrait la précision. */
  amountXof: string | null;
  /** `BankRejectionReason.code`. */
  rejectionReasonCode: string | null;
  rejectionDetail: string | null;
  comment: string | null;
  daysAgo: number;
}

export interface DemoBankCase {
  key: string;
  reference: string;
  /**
   * Toujours un prospect `METHOD_OBTAINED` : c'est la règle produit, un
   * dossier bancaire ne s'ouvre que sur une méthode d'enrôlement obtenue.
   *
   * `customerName` et `customerPhoneE164` ne figurent pas ici : le semeur les
   * COPIE depuis le prospect à la création, comme le fait l'application.
   */
  prospectKey: string;
  /** `Banque.shortName` de la banque qui traite le dossier. */
  processingBankShortName: string;
  /** `BankCaseStage.code` : égal au `toStageCode` de la dernière transition. */
  currentStageCode: string;
  /** `null` tant que le dossier est ouvert, `"0"` s'il est rejeté. */
  amountXof: string | null;
  /** `BankRejectionReason.code`, obligatoire si l'étape est `REJETE`. */
  rejectionReasonCode: string | null;
  rejectionDetail: string | null;
  createdByKey: string;
  updatedByKey: string | null;
  daysAgo: number;
  transitions: DemoBankCaseTransition[];
}

export interface DemoDataset {
  users: DemoUser[];
  representants: DemoRepresentant[];
  prospects: DemoProspect[];
  campaigns: DemoCampaign[];
  bankCases: DemoBankCase[];
}
