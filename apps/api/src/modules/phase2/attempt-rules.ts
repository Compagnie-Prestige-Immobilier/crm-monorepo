import { BadRequestException } from '@nestjs/common';
import type { EnrollmentMethod } from '@crm/database';
import { CallOutcome, Phase2Status } from '@crm/database';

/**
 * Règles de cohérence d'une tentative d'appel — miroir applicatif des
 * contraintes CHECK posées par la migration `20260812141010_phase2_and_bank_finance`.
 *
 * Elles sont écrites DEUX FOIS, ici et en base, et c'est délibéré :
 *
 * - en base, parce qu'un correctif SQL manuel ou un futur chemin d'écriture ne
 *   doit pas pouvoir produire une ligne incohérente ;
 * - ici, parce qu'une violation de CHECK remonte en 500 côté client. Le mobile
 *   ne sait rien faire d'un 500 sinon rejouer indéfiniment un lot voué à
 *   échouer. Il lui faut un code métier et un message.
 *
 * Les tests d'intégration vérifient que les deux définitions coïncident : toute
 * entrée acceptée ici est acceptée par la base.
 */

/** Longueur maximale d'un commentaire — identique à la contrainte CHECK. */
export const COMMENT_MAX_LENGTH = 2_000;

/**
 * Issues qui CLÔTURENT le dossier du prospect. Les trois autres
 * (`UNREACHABLE`, `CALLBACK`, `OTHER`) enregistrent une trace et laissent la
 * tâche ouverte : le prospect reste à rappeler.
 */
export const TERMINAL_OUTCOMES = [
  CallOutcome.METHOD_OBTAINED,
  CallOutcome.REFUSED,
  CallOutcome.WRONG_NUMBER,
] as const;

export type TerminalOutcome = (typeof TERMINAL_OUTCOMES)[number];

export function isTerminalOutcome(outcome: CallOutcome): outcome is TerminalOutcome {
  return (TERMINAL_OUTCOMES as readonly CallOutcome[]).includes(outcome);
}

/** Statut de phase 2 résultant d'une issue terminale. */
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
  /** Non nulle si et seulement si `outcome = METHOD_OBTAINED`. */
  readonly method: EnrollmentMethod | null;
  /** Rognée ; nulle plutôt que vide, pour que la contrainte CHECK tienne. */
  readonly comment: string | null;
  readonly terminal: boolean;
}

const invalid = (code: string, message: string): never => {
  throw new BadRequestException({ code, message });
};

/**
 * Valide et normalise le corps d'une tentative.
 *
 * Une méthode envoyée avec une issue qui n'en admet pas est REFUSÉE, pas
 * ignorée silencieusement : côté mobile, cela signifie qu'une case a été cochée
 * dans une branche d'écran incohérente, et la faire disparaître sans rien dire
 * masquerait le bug d'interface jusqu'à ce qu'un prospect se retrouve avec une
 * méthode qu'il n'a jamais donnée.
 */
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
