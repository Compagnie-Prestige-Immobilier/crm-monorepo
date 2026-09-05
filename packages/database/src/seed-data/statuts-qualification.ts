export interface StatutQualificationSeed {
  code: string;
  label: string;
  effect: 'REACHED' | 'REFUSED' | 'SCHEDULE_CALLBACK' | 'UNREACHABLE' | 'WRONG_NUMBER';
  requiresCallback: boolean;
  /** « Autre » ne dit rien tant qu'on ne l'a pas ecrit. */
  requiresComment: boolean;
  /** Delai apres lequel la fiche repasse d'elle-meme en file. Nul : jamais. */
  retryAfterMinutes: number | null;
  priorite: 'HAUTE' | 'NORMALE' | 'BASSE';
  /**
   * La relation que le statut pose sur la fiche, nulle quand il ne tranche
   * rien : « a rappeler » ne tranche pas, un numero occupe ne dit rien de
   * l'interet, et un representant decede n'a refuse personne.
   */
  relationStatus: 'INCONNU' | 'CONTACTE' | 'AMBASSADEUR' | 'REFUS' | null;
  sortOrder: number;
}

/**
 * Les quinze statuts du Lot 1, dans l'ordre de l'expression de besoins.
 *
 * L'effet dit l'issue a enregistrer ET la famille ou le statut se propose :
 * seul UNREACHABLE est non joint. WRONG_NUMBER est joint, la fiche est traitee
 * et sort des injoignables. Pas de champ « joignable » a cote, il divergerait
 * de l'effet a la premiere correction.
 *
 * Les sept statuts d'avant le Lot 1 (INTERESSE, TRES_INTERESSE, RDV_OBTENU,
 * DEMANDE_INFOS, NON_INTERESSE, NON_ELIGIBLE, NUMERO_INVALIDE) ne sont plus ici
 * mais leurs lignes restent en base, desactivees : l'historique les designe.
 *
 * Tous poses en `isSystem` : le script s'appuie dessus, et les desactiver
 * toutes laisserait une famille sans issue possible.
 */
export const STATUTS_QUALIFICATION: readonly StatutQualificationSeed[] = [
  // Joint
  {
    code: 'ACCEPTE',
    label: 'Accepté',
    effect: 'REACHED',
    requiresCallback: false,
    requiresComment: false,
    retryAfterMinutes: null,
    priorite: 'HAUTE',
    relationStatus: 'AMBASSADEUR',
    sortOrder: 10,
  },
  {
    code: 'REFUSE',
    label: 'Refusé',
    effect: 'REFUSED',
    requiresCallback: false,
    requiresComment: false,
    retryAfterMinutes: null,
    priorite: 'BASSE',
    relationStatus: 'REFUS',
    sortOrder: 20,
  },
  // Le seul qui exige une date : c'est lui qui arme l'alarme du telephone.
  {
    code: 'A_RAPPELER',
    label: 'À rappeler',
    effect: 'SCHEDULE_CALLBACK',
    requiresCallback: true,
    requiresComment: false,
    retryAfterMinutes: null,
    priorite: 'HAUTE',
    relationStatus: null,
    sortOrder: 30,
  },
  {
    code: 'DECEDE',
    label: 'Décédé',
    effect: 'REFUSED',
    requiresCallback: false,
    requiresComment: false,
    retryAfterMinutes: null,
    priorite: 'BASSE',
    relationStatus: null,
    sortOrder: 40,
  },
  {
    code: 'RETRAITE',
    label: 'Retraité',
    effect: 'REFUSED',
    requiresCallback: false,
    requiresComment: false,
    retryAfterMinutes: null,
    priorite: 'BASSE',
    relationStatus: null,
    sortOrder: 50,
  },
  {
    code: 'HORS_CIBLE',
    label: 'Hors cible',
    effect: 'REFUSED',
    requiresCallback: false,
    requiresComment: false,
    retryAfterMinutes: null,
    priorite: 'BASSE',
    relationStatus: null,
    sortOrder: 60,
  },
  {
    code: 'AFFECTE_AILLEURS',
    label: 'Affecté ailleurs',
    effect: 'REFUSED',
    requiresCallback: false,
    requiresComment: false,
    retryAfterMinutes: null,
    priorite: 'BASSE',
    relationStatus: null,
    sortOrder: 70,
  },
  {
    code: 'FAUX_NUMERO',
    label: 'Faux numéro',
    effect: 'WRONG_NUMBER',
    requiresCallback: false,
    requiresComment: false,
    retryAfterMinutes: null,
    priorite: 'BASSE',
    relationStatus: null,
    sortOrder: 80,
  },
  // Deux « Autre », un par famille, et `label` porte un index unique : les
  // libelles se distinguent en base, l'ecran les affiche sous l'en-tete de leur
  // famille ou la precision est redondante.
  {
    code: 'AUTRE_JOINT',
    label: 'Autre joint',
    effect: 'REACHED',
    requiresCallback: false,
    requiresComment: true,
    retryAfterMinutes: null,
    priorite: 'NORMALE',
    relationStatus: null,
    sortOrder: 90,
  },

  // Non joint
  {
    code: 'PAS_DE_REPONSE',
    label: 'Pas de réponse',
    effect: 'UNREACHABLE',
    requiresCallback: false,
    requiresComment: false,
    retryAfterMinutes: 120,
    priorite: 'NORMALE',
    relationStatus: null,
    sortOrder: 110,
  },
  // Le code est fige a la creation, pas le libelle : celui-ci disait
  // « Numero occupe » avant le Lot 1.
  {
    code: 'NUMERO_OCCUPE',
    label: 'Occupé',
    effect: 'UNREACHABLE',
    requiresCallback: false,
    requiresComment: false,
    retryAfterMinutes: 30,
    priorite: 'NORMALE',
    relationStatus: null,
    sortOrder: 120,
  },
  {
    code: 'MESSAGERIE',
    label: 'Messagerie',
    effect: 'UNREACHABLE',
    requiresCallback: false,
    requiresComment: false,
    retryAfterMinutes: 240,
    priorite: 'NORMALE',
    relationStatus: null,
    sortOrder: 130,
  },
  {
    code: 'TELEPHONE_INDISPONIBLE',
    label: 'Téléphone indisponible',
    effect: 'UNREACHABLE',
    requiresCallback: false,
    requiresComment: false,
    retryAfterMinutes: 1440,
    priorite: 'NORMALE',
    relationStatus: null,
    sortOrder: 140,
  },
  // Le seul non joint qui ne repasse jamais.
  {
    code: 'INJOIGNABLE_DEFINITIF',
    label: 'Injoignable définitif',
    effect: 'UNREACHABLE',
    requiresCallback: false,
    requiresComment: false,
    retryAfterMinutes: null,
    priorite: 'BASSE',
    relationStatus: null,
    sortOrder: 150,
  },
  {
    code: 'AUTRE_NON_JOINT',
    label: 'Autre non joint',
    effect: 'UNREACHABLE',
    requiresCallback: false,
    requiresComment: true,
    retryAfterMinutes: 1440,
    priorite: 'NORMALE',
    relationStatus: null,
    sortOrder: 160,
  },
];

/**
 * Les fiches qualifiees avant le Lot 1 changent de statut, jamais d'effet :
 * `outcome` et `relationStatus`, deja ecrits, restent exacts. La reprise vit
 * dans `20260905100000_liste_des_statuts_du_lot_1` ; cette table la decrit pour
 * qui relit, et le test la compare au SQL.
 */
export const CONVERSIONS_STATUT_LOT_1: readonly (readonly [string, string])[] = [
  ['INTERESSE', 'ACCEPTE'],
  ['TRES_INTERESSE', 'ACCEPTE'],
  ['RDV_OBTENU', 'ACCEPTE'],
  ['DEMANDE_INFOS', 'ACCEPTE'],
  ['NON_INTERESSE', 'REFUSE'],
  ['NON_ELIGIBLE', 'REFUSE'],
  ['NUMERO_INVALIDE', 'FAUX_NUMERO'],
];
