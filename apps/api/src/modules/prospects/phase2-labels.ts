import {
  CallOutcome,
  EnrollmentMethod,
  ModeEpargne,
  Phase2Status,
  Projet,
  ProspectStatut,
  ProspectType,
  TypeContrat,
} from '@crm/database';

export const PROJET_LABELS: Readonly<Record<Projet, string>> = {
  [Projet.CHUES]: 'CHUES',
  [Projet.GRAND_PUBLIC]: 'Grand Public',
};

export const PROSPECT_STATUT_LABELS: Readonly<Record<ProspectStatut, string>> = {
  [ProspectStatut.NOUVEAU]: 'Nouveau',
  [ProspectStatut.CONTACTE]: 'Contacté',
  [ProspectStatut.CONVERTI]: 'Converti',
  [ProspectStatut.PERDU]: 'Perdu',
};

export const PROSPECT_TYPE_LABELS: Readonly<Record<ProspectType, string>> = {
  [ProspectType.FONCTIONNAIRE]: 'Fonctionnaire',
  [ProspectType.SECTEUR_PRIVE]: 'Secteur privé',
  [ProspectType.INFORMEL]: 'Informel',
  [ProspectType.DIASPORA]: 'Diaspora',
};

export const TYPE_CONTRAT_LABELS: Readonly<Record<TypeContrat, string>> = {
  [TypeContrat.CDI]: 'CDI',
  [TypeContrat.CDD]: 'CDD',
  [TypeContrat.AUTRE]: 'Autre',
};

export const MODE_EPARGNE_LABELS: Readonly<Record<ModeEpargne, string>> = {
  [ModeEpargne.TONTINE]: 'Tontine',
  [ModeEpargne.MOBILE_MONEY]: 'Mobile money',
  [ModeEpargne.BANQUE]: 'Banque',
  [ModeEpargne.AUCUN]: 'Aucun',
};

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
  [EnrollmentMethod.APPOINTMENT]: 'Prise de rendez-vous',
};

export const CALL_OUTCOME_LABELS: Readonly<Record<CallOutcome, string>> = {
  [CallOutcome.METHOD_OBTAINED]: 'Méthode obtenue',
  [CallOutcome.UNREACHABLE]: 'Injoignable',
  [CallOutcome.CALLBACK]: 'À rappeler',
  [CallOutcome.REFUSED]: 'Refus',
  [CallOutcome.WRONG_NUMBER]: 'Mauvais numéro',
  [CallOutcome.OTHER]: 'Autre',
};

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
  EnrollmentMethod.APPOINTMENT,
];
