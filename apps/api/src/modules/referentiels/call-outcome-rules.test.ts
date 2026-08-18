import { BadRequestException } from '@nestjs/common';
import { CallOutcome, EnrollmentMethod } from '@crm/database';
import { describe, expect, it } from 'vitest';

import { UNUSABLE_OUTCOMES } from '../analytics/pilotage.sql.js';
import {
  PHASE2_STATUS_FOR_OUTCOME,
  isTerminalOutcome,
  normalizeAttempt,
} from '../phase2/attempt-rules.js';
import {
  CALL_OUTCOME_EFFECT_VALUES,
  CallOutcomeEffect,
  OUTCOME_EFFECT_RULES,
  SYSTEM_OUTCOME_REASONS,
  outcomeEffectRule,
} from './call-outcome-rules.js';

describe('effets d’issue', () => {
  it.each(CALL_OUTCOME_EFFECT_VALUES)('%s porte une règle complète', (effect) => {
    const rule = outcomeEffectRule(effect);

    expect(typeof rule.closes).toBe('boolean');
    expect(typeof rule.requiresMethod).toBe('boolean');
    expect(typeof rule.acceptsCallbackAt).toBe('boolean');
    expect(rule.closes).toBe(rule.phase2Status !== null);
  });

  it('ne traite aucun effet inconnu en silence', () => {
    expect(() => outcomeEffectRule('CLOSE_EVERYTHING')).toThrow(
      /Effet d’issue non traité|Effet d'issue non traité/,
    );
  });

  it('un seul effet accepte une échéance de rappel', () => {
    const accepting = CALL_OUTCOME_EFFECT_VALUES.filter(
      (effect) => OUTCOME_EFFECT_RULES[effect].acceptsCallbackAt,
    );
    expect(accepting).toEqual([CallOutcomeEffect.SCHEDULE_CALLBACK]);
  });

  it('un seul effet exige une méthode d’enrôlement', () => {
    const requiring = CALL_OUTCOME_EFFECT_VALUES.filter(
      (effect) => OUTCOME_EFFECT_RULES[effect].requiresMethod,
    );
    expect(requiring).toEqual([CallOutcomeEffect.CLOSE_METHOD]);
  });

  it('deux effets clos ne partagent pas un statut de phase 2', () => {
    const statuses = CALL_OUTCOME_EFFECT_VALUES.map(
      (effect) => OUTCOME_EFFECT_RULES[effect].phase2Status,
    ).filter((status) => status !== null);
    expect(new Set(statuses).size).toBe(statuses.length);
  });
});

describe('motifs système', () => {
  it('couvrent EXACTEMENT les valeurs de CallOutcome, code pour code', () => {
    expect(SYSTEM_OUTCOME_REASONS.map((reason) => reason.code).sort()).toEqual(
      Object.values(CallOutcome).sort(),
    );
  });

  it('portent un libellé et un ordre distincts', () => {
    const labels = SYSTEM_OUTCOME_REASONS.map((reason) => reason.label);
    const orders = SYSTEM_OUTCOME_REASONS.map((reason) => reason.sortOrder);
    expect(new Set(labels).size).toBe(labels.length);
    expect(new Set(orders).size).toBe(orders.length);
    expect(labels.every((label) => label.trim().length > 1)).toBe(true);
  });

  it.each(SYSTEM_OUTCOME_REASONS)(
    '$code reproduit la clôture compilée dans attempt-rules',
    (reason) => {
      const rule = outcomeEffectRule(reason.effect);
      expect(rule.closes).toBe(isTerminalOutcome(reason.code));
      if (rule.closes) {
        expect(rule.phase2Status).toBe(
          PHASE2_STATUS_FOR_OUTCOME[reason.code as keyof typeof PHASE2_STATUS_FOR_OUTCOME],
        );
      }
    },
  );

  it.each(SYSTEM_OUTCOME_REASONS)(
    '$code reproduit l’exigence de méthode compilée dans attempt-rules',
    (reason) => {
      const rule = outcomeEffectRule(reason.effect);
      const accepted = (): boolean => {
        try {
          normalizeAttempt({
            outcome: reason.code,
            method: EnrollmentMethod.PLATFORM,
            comment: 'motif',
          });
          return true;
        } catch (error) {
          expect(error).toBeInstanceOf(BadRequestException);
          return false;
        }
      };
      expect(accepted()).toBe(rule.requiresMethod);
    },
  );

  it.each(SYSTEM_OUTCOME_REASONS)(
    '$code reproduit l’exigence de commentaire compilée dans attempt-rules',
    (reason) => {
      const rule = outcomeEffectRule(reason.effect);
      if (rule.requiresMethod) return;

      let refused = false;
      try {
        normalizeAttempt({ outcome: reason.code, method: null, comment: null });
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        refused = true;
      }
      expect(refused).toBe(reason.requiresComment);
    },
  );

  it('n’exige une échéance de rappel sur AUCUN motif système', () => {
    expect(SYSTEM_OUTCOME_REASONS.filter((reason) => reason.requiresCallback)).toEqual([]);
    expect(() =>
      normalizeAttempt({ outcome: CallOutcome.CALLBACK, method: null, callbackAt: null }),
    ).not.toThrow();
  });

  it('classe la joignabilité comme UNUSABLE_OUTCOMES du pilotage', () => {
    const sql = UNUSABLE_OUTCOMES.sql;
    for (const reason of SYSTEM_OUTCOME_REASONS) {
      expect(sql.includes(`'${reason.code}'`), `${reason.code} dans ${sql}`).toBe(
        !reason.countsAsReached,
      );
    }
  });
});
