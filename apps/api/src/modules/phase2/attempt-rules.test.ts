import { BadRequestException } from '@nestjs/common';
import { CallOutcome, EnrollmentMethod, Phase2Status } from '@crm/database';
import { describe, expect, it } from 'vitest';

import {
  COMMENT_MAX_LENGTH,
  PHASE2_STATUS_FOR_OUTCOME,
  isTerminalOutcome,
  normalizeAttempt,
} from './attempt-rules.js';

/** Extrait le code métier d'une exception Nest, ou échoue. */
function codeOf(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(BadRequestException);
    const body = (error as BadRequestException).getResponse() as { code?: string };
    return body.code ?? '';
  }
  throw new Error('aucune exception levée');
}

describe('isTerminalOutcome', () => {
  it('classe les six issues', () => {
    expect(isTerminalOutcome(CallOutcome.METHOD_OBTAINED)).toBe(true);
    expect(isTerminalOutcome(CallOutcome.REFUSED)).toBe(true);
    expect(isTerminalOutcome(CallOutcome.WRONG_NUMBER)).toBe(true);
    expect(isTerminalOutcome(CallOutcome.UNREACHABLE)).toBe(false);
    expect(isTerminalOutcome(CallOutcome.CALLBACK)).toBe(false);
    expect(isTerminalOutcome(CallOutcome.OTHER)).toBe(false);
  });

  it('associe un statut de phase 2 à chaque issue terminale', () => {
    expect(PHASE2_STATUS_FOR_OUTCOME[CallOutcome.METHOD_OBTAINED]).toBe(
      Phase2Status.METHOD_OBTAINED,
    );
    expect(PHASE2_STATUS_FOR_OUTCOME[CallOutcome.REFUSED]).toBe(Phase2Status.REFUSED);
    expect(PHASE2_STATUS_FOR_OUTCOME[CallOutcome.WRONG_NUMBER]).toBe(Phase2Status.WRONG_NUMBER);
  });
});

describe('normalizeAttempt — méthode et issue', () => {
  it('accepte les trois méthodes avec METHOD_OBTAINED', () => {
    for (const method of Object.values(EnrollmentMethod)) {
      const result = normalizeAttempt({ outcome: CallOutcome.METHOD_OBTAINED, method });
      expect(result.method).toBe(method);
      expect(result.terminal).toBe(true);
    }
  });

  it('refuse METHOD_OBTAINED sans méthode', () => {
    expect(codeOf(() => normalizeAttempt({ outcome: CallOutcome.METHOD_OBTAINED }))).toBe(
      'PHASE2_METHOD_REQUIRED',
    );
    expect(
      codeOf(() => normalizeAttempt({ outcome: CallOutcome.METHOD_OBTAINED, method: null })),
    ).toBe('PHASE2_METHOD_REQUIRED');
  });

  it('refuse une méthode sur toute autre issue', () => {
    for (const outcome of [
      CallOutcome.REFUSED,
      CallOutcome.WRONG_NUMBER,
      CallOutcome.UNREACHABLE,
      CallOutcome.CALLBACK,
    ]) {
      expect(codeOf(() => normalizeAttempt({ outcome, method: EnrollmentMethod.PLATFORM }))).toBe(
        'PHASE2_METHOD_NOT_ALLOWED',
      );
    }
    expect(
      codeOf(() =>
        normalizeAttempt({
          outcome: CallOutcome.OTHER,
          method: EnrollmentMethod.PHYSICAL,
          comment: 'injoignable, boîte vocale saturée',
        }),
      ),
    ).toBe('PHASE2_METHOD_NOT_ALLOWED');
  });

  it('accepte REFUSED et WRONG_NUMBER sans méthode, et les marque terminales', () => {
    for (const outcome of [CallOutcome.REFUSED, CallOutcome.WRONG_NUMBER]) {
      const result = normalizeAttempt({ outcome });
      expect(result.method).toBeNull();
      expect(result.terminal).toBe(true);
    }
  });

  it('laisse la tâche ouverte pour UNREACHABLE, CALLBACK et OTHER', () => {
    expect(normalizeAttempt({ outcome: CallOutcome.UNREACHABLE }).terminal).toBe(false);
    expect(normalizeAttempt({ outcome: CallOutcome.CALLBACK }).terminal).toBe(false);
    expect(
      normalizeAttempt({ outcome: CallOutcome.OTHER, comment: 'rappelle lundi' }).terminal,
    ).toBe(false);
  });
});

describe('normalizeAttempt — commentaire', () => {
  it('exige un commentaire non vide pour OTHER', () => {
    expect(codeOf(() => normalizeAttempt({ outcome: CallOutcome.OTHER }))).toBe(
      'PHASE2_COMMENT_REQUIRED',
    );
    expect(codeOf(() => normalizeAttempt({ outcome: CallOutcome.OTHER, comment: '   ' }))).toBe(
      'PHASE2_COMMENT_REQUIRED',
    );
  });

  it('rogne le commentaire et remplace le vide par null', () => {
    expect(
      normalizeAttempt({ outcome: CallOutcome.OTHER, comment: '  ligne coupée  ' }).comment,
    ).toBe('ligne coupée');
    expect(normalizeAttempt({ outcome: CallOutcome.CALLBACK, comment: '   ' }).comment).toBeNull();
    expect(normalizeAttempt({ outcome: CallOutcome.CALLBACK }).comment).toBeNull();
  });

  it('accepte un commentaire facultatif sur les autres issues', () => {
    expect(
      normalizeAttempt({ outcome: CallOutcome.UNREACHABLE, comment: 'sonne dans le vide' }).comment,
    ).toBe('sonne dans le vide');
  });

  it('refuse un commentaire au-delà de la limite de la contrainte CHECK', () => {
    const tooLong = 'x'.repeat(COMMENT_MAX_LENGTH + 1);
    expect(codeOf(() => normalizeAttempt({ outcome: CallOutcome.OTHER, comment: tooLong }))).toBe(
      'PHASE2_COMMENT_TOO_LONG',
    );
    // La limite exacte passe.
    expect(
      normalizeAttempt({ outcome: CallOutcome.OTHER, comment: 'x'.repeat(COMMENT_MAX_LENGTH) })
        .comment,
    ).toHaveLength(COMMENT_MAX_LENGTH);
  });
});
