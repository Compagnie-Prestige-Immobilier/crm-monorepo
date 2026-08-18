import { BadRequestException } from '@nestjs/common';
import type { EnrollmentMethod } from '@crm/database';
import { CallOutcome, Phase2Status } from '@crm/database';

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

export interface RawAttempt {
  readonly outcome: CallOutcome;
  readonly method?: EnrollmentMethod | null;
  readonly comment?: string | null;
  readonly callbackAt?: string | null;
  readonly clientCreatedAt?: string | null;
}

export interface NormalizedAttempt {
  readonly outcome: CallOutcome;
  readonly method: EnrollmentMethod | null;
  readonly comment: string | null;
  readonly callbackAt: Date | null;
  readonly terminal: boolean;
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

export function normalizeAttempt(input: RawAttempt): NormalizedAttempt {
  const terminal = isTerminalOutcome(input.outcome);
  const method = input.method ?? null;
  const rawComment = input.comment ?? null;
  const comment = rawComment === null || rawComment.trim() === '' ? null : rawComment.trim();

  if (input.outcome === CallOutcome.METHOD_OBTAINED) {
    if (method === null) {
      invalid(
        'PHASE2_METHOD_REQUIRED',
        'Une méthode d’enrôlement est obligatoire quand la méthode a été obtenue.',
      );
    }
  } else if (method !== null) {
    invalid(
      'PHASE2_METHOD_NOT_ALLOWED',
      'Une méthode d’enrôlement n’est admise que pour l’issue METHOD_OBTAINED.',
    );
  }

  if (input.outcome === CallOutcome.OTHER && comment === null) {
    invalid(
      'PHASE2_COMMENT_REQUIRED',
      'L’issue « Autre » exige un commentaire : sans lui, la case ne dit rien.',
    );
  }

  if (comment !== null && comment.length > COMMENT_MAX_LENGTH) {
    invalid(
      'PHASE2_COMMENT_TOO_LONG',
      `Le commentaire dépasse ${String(COMMENT_MAX_LENGTH)} caractères.`,
    );
  }

  return { outcome: input.outcome, method, comment, callbackAt: callbackAt(input), terminal };
}

/**
 * Une issue CALLBACK sans date n'est PAS refusée : les versions déjà installées
 * proposent « À rappeler » sans date, et un refus mettrait leur saisie en échec
 * à la remontée. Elle donne une tentative, sans rappel planifié.
 */
function callbackAt(input: RawAttempt): Date | null {
  const raw = input.callbackAt ?? null;
  if (raw === null) return null;

  if (input.outcome !== CallOutcome.CALLBACK) {
    invalid(
      'PHASE2_CALLBACK_AT_NOT_ALLOWED',
      'Une date de rappel n’est admise que pour l’issue CALLBACK.',
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
