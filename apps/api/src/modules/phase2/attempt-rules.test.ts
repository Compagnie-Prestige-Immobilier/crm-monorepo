import { BadRequestException } from '@nestjs/common';
import { CallOutcome, EnrollmentMethod, Phase2Status } from '@crm/database';
import { describe, expect, it } from 'vitest';

import {
  CALLBACK_CLOCK_SKEW_TOLERANCE_MS,
  COMMENT_MAX_LENGTH,
  PHASE2_STATUS_FOR_OUTCOME,
  isTerminalOutcome,
  normalizeAttempt,
} from './attempt-rules.js';

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

describe('normalizeAttempt, méthode et issue', () => {
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

describe('normalizeAttempt, date de rappel', () => {
  const APPEL = '2026-08-18T10:00:00.000Z';

  it('retient la date de rappel promise avec CALLBACK', () => {
    const result = normalizeAttempt({
      outcome: CallOutcome.CALLBACK,
      callbackAt: '2026-08-19T09:00:00.000Z',
      clientCreatedAt: APPEL,
    });
    expect(result.callbackAt?.toISOString()).toBe('2026-08-19T09:00:00.000Z');
  });

  it('refuse une date de rappel sur toute autre issue', () => {
    for (const outcome of [
      CallOutcome.UNREACHABLE,
      CallOutcome.REFUSED,
      CallOutcome.WRONG_NUMBER,
      CallOutcome.METHOD_OBTAINED,
    ]) {
      expect(
        codeOf(() =>
          normalizeAttempt({
            outcome,
            ...(outcome === CallOutcome.METHOD_OBTAINED
              ? { method: EnrollmentMethod.PLATFORM }
              : {}),
            callbackAt: '2026-08-19T09:00:00.000Z',
            clientCreatedAt: APPEL,
          }),
        ),
      ).toBe('PHASE2_CALLBACK_AT_NOT_ALLOWED');
    }
  });

  it('refuse une date de rappel illisible', () => {
    expect(
      codeOf(() =>
        normalizeAttempt({
          outcome: CallOutcome.CALLBACK,
          callbackAt: 'demain matin',
          clientCreatedAt: APPEL,
        }),
      ),
    ).toBe('PHASE2_CALLBACK_AT_INVALID');
  });

  it('refuse un rappel antérieur à l’appel qui l’a promis', () => {
    expect(
      codeOf(() =>
        normalizeAttempt({
          outcome: CallOutcome.CALLBACK,
          callbackAt: '2026-08-17T10:00:00.000Z',
          clientCreatedAt: APPEL,
        }),
      ),
    ).toBe('PHASE2_CALLBACK_AT_PAST');
  });

  it('tolère quatre minutes de dérive d’horloge, et pas six', () => {
    expect(
      normalizeAttempt({
        outcome: CallOutcome.CALLBACK,
        callbackAt: '2026-08-18T09:56:00.000Z',
        clientCreatedAt: APPEL,
      }).callbackAt?.toISOString(),
    ).toBe('2026-08-18T09:56:00.000Z');

    expect(
      codeOf(() =>
        normalizeAttempt({
          outcome: CallOutcome.CALLBACK,
          callbackAt: '2026-08-18T09:54:00.000Z',
          clientCreatedAt: APPEL,
        }),
      ),
    ).toBe('PHASE2_CALLBACK_AT_PAST');
  });

  it('reprend la dérive déjà retenue ailleurs dans le dépôt', () => {
    expect(CALLBACK_CLOCK_SKEW_TOLERANCE_MS).toBe(5 * 60_000);
  });

  it('mesure le retard sur l’HEURE DE L’APPEL, pas sur celle du serveur', () => {
    const vieuxLot = normalizeAttempt({
      outcome: CallOutcome.CALLBACK,
      callbackAt: '2020-01-02T09:00:00.000Z',
      clientCreatedAt: '2020-01-01T10:00:00.000Z',
    });
    expect(vieuxLot.callbackAt?.toISOString()).toBe('2020-01-02T09:00:00.000Z');
  });

  it('une issue CALLBACK sans date reste acceptée, sans rappel planifié', () => {
    const result = normalizeAttempt({ outcome: CallOutcome.CALLBACK, clientCreatedAt: APPEL });
    expect(result.callbackAt).toBeNull();
    expect(result.terminal).toBe(false);
  });

  it('aucune autre issue ne se voit imposer la date', () => {
    for (const outcome of [CallOutcome.UNREACHABLE, CallOutcome.REFUSED]) {
      expect(normalizeAttempt({ outcome, clientCreatedAt: APPEL }).callbackAt).toBeNull();
    }
  });
});

describe('normalizeAttempt, commentaire', () => {
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
    expect(
      normalizeAttempt({ outcome: CallOutcome.OTHER, comment: 'x'.repeat(COMMENT_MAX_LENGTH) })
        .comment,
    ).toHaveLength(COMMENT_MAX_LENGTH);
  });
});
