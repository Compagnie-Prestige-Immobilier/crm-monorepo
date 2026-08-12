import { CallOutcome, EnrollmentMethod, Phase2Status } from '@crm/database';

/**
 * Libellés français des énumérations de phase 2.
 *
 * Déclarés une seule fois et partagés par les séries analytiques et par les
 * classeurs Excel : un « Méthode obtenue » dans le graphique face à un
 * « METHOD_OBTAINED » brut dans le fichier exporté oblige l'équipe commerciale
 * à traduire mentalement, et la moindre divergence de vocabulaire entre les
 * deux surfaces se lit comme deux indicateurs différents.
 *
 * Les enregistrements sont typés `Record<Enum, string>` sans valeur par défaut :
 * une valeur ajoutée au schéma Prisma casse la compilation ici plutôt que de
 * produire une cellule vide en production.
 */

export const PHASE2_STATUS_LABELS: Readonly<Record<Phase2Status, string>> = {
  [Phase2Status.PENDING]: 'En attente',
  [Phase2Status.METHOD_OBTAINED]: 'Méthode obtenue',
  [Phase2Status.REFUSED]: 'Refus',
  [Phase2Status.WRONG_NUMBER]: 'Mauvais numéro',
};

export const ENROLLMENT_METHOD_LABELS: Readonly<Record<EnrollmentMethod, string>> = {
  [EnrollmentMethod.PLATFORM]: 'Plateforme',
  [EnrollmentMethod.PHYSICAL]: 'Physique',
  [EnrollmentMethod.VOICE_OR_ELECTRONIC_MESSAGING]: 'Vocal ou messagerie électronique',
};

export const CALL_OUTCOME_LABELS: Readonly<Record<CallOutcome, string>> = {
  [CallOutcome.METHOD_OBTAINED]: 'Méthode obtenue',
  [CallOutcome.UNREACHABLE]: 'Injoignable',
  [CallOutcome.CALLBACK]: 'À rappeler',
  [CallOutcome.REFUSED]: 'Refus',
  [CallOutcome.WRONG_NUMBER]: 'Mauvais numéro',
  [CallOutcome.OTHER]: 'Autre',
};

/** Ordre d'affichage stable des statuts, du plus amont au plus aval. */
export const PHASE2_STATUS_ORDER: readonly Phase2Status[] = [
  Phase2Status.PENDING,
  Phase2Status.METHOD_OBTAINED,
  Phase2Status.REFUSED,
  Phase2Status.WRONG_NUMBER,
];

export const ENROLLMENT_METHOD_ORDER: readonly EnrollmentMethod[] = [
  EnrollmentMethod.PLATFORM,
  EnrollmentMethod.PHYSICAL,
  EnrollmentMethod.VOICE_OR_ELECTRONIC_MESSAGING,
];
