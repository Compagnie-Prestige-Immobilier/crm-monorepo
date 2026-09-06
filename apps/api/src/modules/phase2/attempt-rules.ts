import { BadRequestException } from '@nestjs/common';
import { CallOutcome, EnrollmentMethod, Phase2Status, Projet } from '@crm/database';

import { SYSTEM_OUTCOME_REASONS, outcomeEffectRule } from '../referentiels/call-outcome-rules.js';

export const COMMENT_MAX_LENGTH = 2_000;

/** Même valeur que `IMPORT_CLOCK_SKEW_TOLERANCE_MS` : une seule dérive admise dans le dépôt. */
const CALLBACK_CLOCK_SKEW_TOLERANCE_MS = 5 * 60_000;

export const EMAIL_MAX_LENGTH = 160;
export const DUREE_ETABLISSEMENT_MAX_MOIS = 600;

/**
 * Version de charge utile a partir de laquelle EB-21, EB-22 et EB-24 s'imposent
 * a la conversion CHUES. Le parc en version 7 ne sait pas poser le revenu ni la
 * duree dans la fonction : lui opposer un 400 perdrait la saisie, l'ecran
 * « A corriger » ne proposant qu'un renvoi a l'identique.
 */
const CONVERSION_CHUES_PAYLOAD_VERSION = 8;

/**
 * Volontairement grossier : le serveur n'a pas à trancher la RFC 5322, il refuse
 * ce qui n'est manifestement pas une adresse. Une saisie douteuse mais plausible
 * vaut mieux qu'une fiche abandonnée au téléphone.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Motif appliqué à une tentative. `id` est nul quand il vient de la table
 * compilée : rien à écrire sur la ligne, `outcome` la qualifie déjà.
 */
export interface AttemptReason {
  readonly id: string | null;
  readonly code: string;
  readonly label: string;
  readonly effect: string;
  readonly requiresComment: boolean;
  readonly requiresCallback: boolean;
}

const SYSTEM_REASONS = new Map<string, AttemptReason>(
  SYSTEM_OUTCOME_REASONS.map((reason) => [
    reason.code,
    {
      id: null,
      code: reason.code,
      label: reason.label,
      effect: reason.effect,
      requiresComment: reason.requiresComment,
      requiresCallback: reason.requiresCallback,
    },
  ]),
);

/**
 * Motif de repli d'une issue, et référence de cohérence quand la tentative en
 * porte un autre : le référentiel peut ajouter des motifs, jamais des effets.
 */
export function systemReasonFor(outcome: CallOutcome): AttemptReason {
  const reason = SYSTEM_REASONS.get(outcome);
  if (reason === undefined) throw new Error(`Issue sans motif système : ${outcome}`);
  return reason;
}

export interface RawAttempt {
  readonly outcome: CallOutcome;
  readonly method?: EnrollmentMethod | null;
  readonly comment?: string | null;
  readonly callbackAt?: string | null;
  readonly clientCreatedAt?: string | null;
  readonly email?: string | null;
  readonly fonctionnaire?: boolean | null;
  readonly engagementEnCours?: boolean | null;
  readonly dureeEtablissementMois?: number | null;
  readonly rendezVousAt?: string | null;
}

export interface NormalizedAttempt {
  readonly outcome: CallOutcome;
  readonly reasonId: string | null;
  readonly method: EnrollmentMethod | null;
  readonly comment: string | null;
  readonly callbackAt: Date | null;
  readonly terminal: boolean;
  readonly phase2Status: Phase2Status | null;
  readonly email: string | null;
  readonly fonctionnaire: boolean | null;
  readonly engagementEnCours: boolean | null;
  readonly dureeEtablissementMois: number | null;
  readonly rendezVousAt: Date | null;
}

const invalid = (code: string, message: string): never => {
  throw new BadRequestException({ code, message });
};

/**
 * Référence du « futur » : l'horodatage TERRAIN, jamais l'heure du serveur. Les
 * deux dates sortent de la même horloge, donc un téléphone déréglé les décale
 * ensemble, et un lot poussé trois semaines plus tard reste valide.
 */
const fieldTime = (iso: string | null | undefined): number => {
  const parsed = iso === null || iso === undefined ? Number.NaN : new Date(iso).getTime();
  return Number.isNaN(parsed) ? Date.now() : parsed;
};

/**
 * Clôture, méthode et échéance se décident sur l'EFFET du motif ; commentaire
 * et rappel obligatoires sur le MOTIF lui-même, qui peut durcir la règle de son
 * effet sans jamais l'assouplir.
 */
export function normalizeAttempt(input: RawAttempt, reason?: AttemptReason): NormalizedAttempt {
  const applied = reason ?? systemReasonFor(input.outcome);
  const rule = outcomeEffectRule(applied.effect);

  const method = input.method ?? null;
  const rawComment = input.comment ?? null;
  const comment = rawComment === null || rawComment.trim() === '' ? null : rawComment.trim();

  if (rule.requiresMethod && method === null) {
    invalid(
      'PHASE2_METHOD_REQUIRED',
      'Une méthode d’enrôlement est obligatoire quand la méthode a été obtenue.',
    );
  }

  if (!rule.requiresMethod && method !== null) {
    invalid(
      'PHASE2_METHOD_NOT_ALLOWED',
      'Une méthode d’enrôlement n’est admise que pour une issue qui clôt sur la méthode obtenue.',
    );
  }

  if (applied.requiresComment && comment === null) {
    invalid(
      'PHASE2_COMMENT_REQUIRED',
      `L’issue « ${applied.label} » exige un commentaire : sans lui, la case ne dit rien.`,
    );
  }

  if (comment !== null && comment.length > COMMENT_MAX_LENGTH) {
    invalid(
      'PHASE2_COMMENT_TOO_LONG',
      `Le commentaire dépasse ${String(COMMENT_MAX_LENGTH)} caractères.`,
    );
  }

  return {
    outcome: input.outcome,
    reasonId: applied.id,
    method,
    comment,
    callbackAt: callbackAt(input, applied),
    terminal: rule.closes,
    phase2Status: rule.phase2Status,
    email: email(input),
    fonctionnaire: input.fonctionnaire ?? null,
    engagementEnCours: input.engagementEnCours ?? null,
    dureeEtablissementMois: dureeEtablissementMois(input),
    rendezVousAt: rendezVousAt(input, method),
  };
}

export interface ConversionChues {
  readonly payloadVersion: number;
  readonly projet: Projet;
  readonly method: EnrollmentMethod | null;
  readonly incomeBandId: string | null;
  readonly dureeEtablissementMois: number | null;
}

/**
 * Une methode non nulle signe une conversion : `normalizeAttempt` ne l'admet
 * que sur l'issue qui clot sur la methode obtenue.
 */
export function assertConversionChues(input: ConversionChues): void {
  if (input.payloadVersion < CONVERSION_CHUES_PAYLOAD_VERSION) return;
  if (input.projet !== Projet.CHUES || input.method === null) return;

  if (input.method === EnrollmentMethod.PHYSICAL) {
    invalid(
      'PHASE2_METHOD_RETIREE',
      'La méthode « Physique » est remplacée par « RDV CPI », qui exige la date du rendez-vous.',
    );
  }

  if (input.incomeBandId === null) {
    invalid(
      'PHASE2_REVENU_REQUIRED',
      'La conversion CHUES exige la tranche de revenu mensuel du prospect.',
    );
  }

  if (input.dureeEtablissementMois === null) {
    invalid(
      'PHASE2_DUREE_FONCTION_REQUIRED',
      'La conversion CHUES exige la durée dans la fonction, en mois.',
    );
  }
}

function email(input: RawAttempt): string | null {
  const raw = input.email?.trim() ?? '';
  if (raw === '') return null;

  if (raw.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(raw)) {
    invalid('PHASE2_EMAIL_INVALID', 'L’adresse électronique saisie n’est pas une adresse.');
  }
  return raw;
}

function dureeEtablissementMois(input: RawAttempt): number | null {
  const mois = input.dureeEtablissementMois ?? null;
  if (mois === null) return null;

  if (!Number.isInteger(mois) || mois < 0 || mois > DUREE_ETABLISSEMENT_MAX_MOIS) {
    invalid(
      'PHASE2_DUREE_ETABLISSEMENT_INVALID',
      `La durée dans la fonction s’exprime en mois entiers, de 0 à ${String(DUREE_ETABLISSEMENT_MAX_MOIS)}.`,
    );
  }
  return mois;
}

/**
 * Le rendez-vous se juge sur l'horodatage TERRAIN, comme le rappel : un lot
 * poussé trois semaines plus tard porte une date passée pour le serveur, et la
 * refuser condamnerait une saisie pourtant correcte au moment de l'appel.
 */
function rendezVousAt(input: RawAttempt, method: EnrollmentMethod | null): Date | null {
  const raw = input.rendezVousAt ?? null;
  const prisRendezVous = method === EnrollmentMethod.APPOINTMENT;

  if (raw === null) {
    if (prisRendezVous) {
      invalid('PHASE2_RENDEZ_VOUS_REQUIRED', 'Le RDV CPI exige la date et l’heure du rendez-vous.');
    }
    return null;
  }

  if (!prisRendezVous) {
    invalid(
      'PHASE2_RENDEZ_VOUS_NOT_ALLOWED',
      'Une date de rendez-vous n’est admise que pour la méthode « RDV CPI ».',
    );
  }

  const fixe = new Date(raw);
  if (Number.isNaN(fixe.getTime())) {
    invalid('PHASE2_RENDEZ_VOUS_INVALID', 'La date du rendez-vous est illisible.');
  }

  if (fixe.getTime() < fieldTime(input.clientCreatedAt) - CALLBACK_CLOCK_SKEW_TOLERANCE_MS) {
    invalid('PHASE2_RENDEZ_VOUS_PAST', 'La date du rendez-vous précède l’appel qui l’a fixé.');
  }

  return fixe;
}

/**
 * Une issue CALLBACK sans date n'est PAS refusée : les versions déjà installées
 * proposent « À rappeler » sans date, et un refus mettrait leur saisie en échec
 * à la remontée. Elle donne une tentative, sans rappel planifié. Seul un motif
 * du référentiel, qu'aucun de ces téléphones ne sait émettre, peut l'exiger.
 */
function callbackAt(input: RawAttempt, reason: AttemptReason): Date | null {
  const raw = input.callbackAt ?? null;
  if (raw === null) {
    if (reason.requiresCallback) {
      invalid(
        'PHASE2_CALLBACK_AT_REQUIRED',
        `L’issue « ${reason.label} » exige la date du rappel promis.`,
      );
    }
    return null;
  }

  if (!outcomeEffectRule(reason.effect).acceptsCallbackAt) {
    invalid(
      'PHASE2_CALLBACK_AT_NOT_ALLOWED',
      'Une date de rappel n’est admise que pour une issue qui planifie un rappel.',
    );
  }

  const scheduled = new Date(raw);
  if (Number.isNaN(scheduled.getTime())) {
    invalid('PHASE2_CALLBACK_AT_INVALID', 'La date de rappel est illisible.');
  }

  if (scheduled.getTime() < fieldTime(input.clientCreatedAt) - CALLBACK_CLOCK_SKEW_TOLERANCE_MS) {
    invalid('PHASE2_CALLBACK_AT_PAST', 'La date de rappel précède l’appel qui l’a promise.');
  }

  return scheduled;
}
