import { BadRequestException } from '@nestjs/common';
import type { EnrollmentMethod } from '@crm/database';
import { CallOutcome, Phase2Status } from '@crm/database';

import { SYSTEM_OUTCOME_REASONS, outcomeEffectRule } from '../referentiels/call-outcome-rules.js';

export const COMMENT_MAX_LENGTH = 2_000;

export const TERMINAL_OUTCOMES = [
  CallOutcome.METHOD_OBTAINED,
  CallOutcome.REFUSED,
  CallOutcome.WRONG_NUMBER,
] as const;

export type TerminalOutcome = (typeof TERMINAL_OUTCOMES)[number];

export function isTerminalOutcome(outcome: CallOutcome): outcome is TerminalOutcome {
  return (TERMINAL_OUTCOMES as readonly CallOutcome[]).includes(outcome);
}

export const PHASE2_STATUS_FOR_OUTCOME: Readonly<Record<TerminalOutcome, Phase2Status>> = {
  [CallOutcome.METHOD_OBTAINED]: Phase2Status.METHOD_OBTAINED,
  [CallOutcome.REFUSED]: Phase2Status.REFUSED,
  [CallOutcome.WRONG_NUMBER]: Phase2Status.WRONG_NUMBER,
};

/** Même valeur que `IMPORT_CLOCK_SKEW_TOLERANCE_MS` : une seule dérive admise dans le dépôt. */
export const CALLBACK_CLOCK_SKEW_TOLERANCE_MS = 5 * 60_000;

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
}

export interface NormalizedAttempt {
  readonly outcome: CallOutcome;
  readonly reasonId: string | null;
  readonly method: EnrollmentMethod | null;
  readonly comment: string | null;
  readonly callbackAt: Date | null;
  readonly terminal: boolean;
  readonly phase2Status: Phase2Status | null;
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
  };
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
