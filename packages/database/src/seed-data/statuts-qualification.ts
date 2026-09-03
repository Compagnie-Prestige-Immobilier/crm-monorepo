export interface StatutQualificationSeed {
  code: string;
  label: string;
  effect: 'REACHED' | 'REFUSED' | 'SCHEDULE_CALLBACK' | 'UNREACHABLE' | 'WRONG_NUMBER';
  requiresCallback: boolean;
  sortOrder: number;
}

/**
 * Les treize statuts du script de qualification, dans l'ordre ou la directrice
 * commerciale les dicte.
 *
 * L'effet dit l'issue a enregistrer ET la branche ou le statut se propose :
 * UNREACHABLE et WRONG_NUMBER appartiennent a l'appel qui n'a pas abouti. Pas
 * de champ « joignable » a cote, il divergerait de l'effet a la premiere
 * correction.
 *
 * Tous poses en `isSystem` : le script s'appuie dessus, et les desactiver
 * toutes laisserait une branche sans issue possible.
 */
export const STATUTS_QUALIFICATION: readonly StatutQualificationSeed[] = [
  // Appel abouti
  {
    code: 'INTERESSE',
    label: 'Intéressé',
    effect: 'REACHED',
    requiresCallback: false,
    sortOrder: 10,
  },
  {
    code: 'TRES_INTERESSE',
    label: 'Très intéressé',
    effect: 'REACHED',
    requiresCallback: false,
    sortOrder: 20,
  },
  {
    code: 'RDV_OBTENU',
    label: 'Rendez-vous obtenu',
    effect: 'REACHED',
    requiresCallback: false,
    sortOrder: 30,
  },
  {
    code: 'DEMANDE_INFOS',
    label: 'Demande d’informations',
    effect: 'REACHED',
    requiresCallback: false,
    sortOrder: 40,
  },
  {
    code: 'NON_INTERESSE',
    label: 'Non intéressé',
    effect: 'REFUSED',
    requiresCallback: false,
    sortOrder: 50,
  },
  {
    code: 'NON_ELIGIBLE',
    label: 'Non éligible',
    effect: 'REFUSED',
    requiresCallback: false,
    sortOrder: 60,
  },
  // Le seul qui exige une date : c'est lui qui arme l'alarme du telephone.
  {
    code: 'A_RAPPELER',
    label: 'À rappeler',
    effect: 'SCHEDULE_CALLBACK',
    requiresCallback: true,
    sortOrder: 70,
  },

  // Appel non abouti
  {
    code: 'PAS_DE_REPONSE',
    label: 'Pas de réponse',
    effect: 'UNREACHABLE',
    requiresCallback: false,
    sortOrder: 110,
  },
  {
    code: 'TELEPHONE_INDISPONIBLE',
    label: 'Téléphone indisponible',
    effect: 'UNREACHABLE',
    requiresCallback: false,
    sortOrder: 120,
  },
  {
    code: 'NUMERO_OCCUPE',
    label: 'Numéro occupé',
    effect: 'UNREACHABLE',
    requiresCallback: false,
    sortOrder: 130,
  },
  {
    code: 'MESSAGERIE',
    label: 'Messagerie',
    effect: 'UNREACHABLE',
    requiresCallback: false,
    sortOrder: 140,
  },
  {
    code: 'FAUX_NUMERO',
    label: 'Faux numéro',
    effect: 'WRONG_NUMBER',
    requiresCallback: false,
    sortOrder: 150,
  },
  {
    code: 'NUMERO_INVALIDE',
    label: 'Numéro invalide',
    effect: 'WRONG_NUMBER',
    requiresCallback: false,
    sortOrder: 160,
  },
];
