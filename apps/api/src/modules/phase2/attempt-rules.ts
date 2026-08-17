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

export interface RawAttempt {
  readonly outcome: CallOutcome;
  readonly method?: EnrollmentMethod | null;
  readonly comment?: string | null;
}

export interface NormalizedAttempt {
  readonly outcome: CallOutcome;
  readonly method: EnrollmentMethod | null;
  readonly comment: string | null;
  readonly terminal: boolean;
}

const invalid = (code: string, message: string): never => {
  throw new BadRequestException({ code, message });
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

  return { outcome: input.outcome, method, comment, terminal };
}
