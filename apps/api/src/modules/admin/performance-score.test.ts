import { describe, expect, it } from 'vitest';

import { performanceScore, type ScoreInput, type ScoreKey } from './performance-score.js';

const JOURNEE: ScoreInput = {
  activeSecondsInShifts: 7200,
  shiftSecondsElapsed: 7200,
  calls: 30,
  reached: 16,
  qualified: 13,
  repeatCalls: 3,
  deadSeconds: 0,
};

const ratioOf = (input: ScoreInput, key: ScoreKey): number | undefined =>
  performanceScore(input).parts.find((part) => part.key === key)?.ratio;

describe('score de rendement', () => {
  it('ne note pas une journée qui n’a pas commencé', () => {
    const score = performanceScore({ ...JOURNEE, shiftSecondsElapsed: 0 });
    expect(score.value).toBeNull();
    expect(score.reason).toBe('journee_non_commencee');
  });

  it('ne note pas un appareil dont la présence n’est pas mesurée', () => {
    const score = performanceScore({ ...JOURNEE, activeSecondsInShifts: 0 });
    expect(score.value).toBeNull();
    expect(score.reason).toBe('presence_non_mesuree');
  });

  it('ne note pas zéro un compte qui n’avait rien à appeler', () => {
    const score = performanceScore({
      ...JOURNEE,
      calls: 0,
      reached: 0,
      qualified: 0,
      repeatCalls: 0,
    });
    expect(score.value).toBeNull();
    expect(score.reason).toBe('aucun_appel');
    expect(score.parts).toEqual([]);
  });

  it('note une matinée pleine au-dessus de toutes les cibles', () => {
    expect(performanceScore(JOURNEE).value).toBe(100);
  });

  it('note une demi-journée à demi-régime sur chacune de ses parts', () => {
    const score = performanceScore({
      activeSecondsInShifts: 7200,
      shiftSecondsElapsed: 14400,
      calls: 12,
      reached: 6,
      qualified: 3,
      repeatCalls: 0,
      deadSeconds: 3600,
    });
    expect(score.value).toBe(68);
    expect(score.parts.map((part) => part.ratio)).toEqual([0.5, 0.5, 0.5, 1, 0.5 / 0.6, 1]);
  });

  it('coupe le temps mort dans la régularité', () => {
    expect(ratioOf({ ...JOURNEE, deadSeconds: 1800 }, 'regularite')).toBe(0.75);
  });

  it('compte chaque rappel d’une même fiche contre l’efficience', () => {
    expect(ratioOf({ ...JOURNEE, repeatCalls: 15 }, 'efficience')).toBe(0.5);
  });

  it('plafonne le rythme : appeler deux fois la cible ne vaut pas deux fois plus', () => {
    const cible = { ...JOURNEE, calls: 24 };
    expect(ratioOf(cible, 'rythme')).toBe(1);
    expect(ratioOf({ ...cible, calls: 48 }, 'rythme')).toBe(1);
  });

  it('ne qualifie rien quand personne n’a répondu', () => {
    expect(ratioOf({ ...JOURNEE, reached: 0, qualified: 0 }, 'qualification')).toBe(0);
  });

  it('répartit exactement cent pour cent entre ses parts', () => {
    const parts = performanceScore(JOURNEE).parts;
    expect(parts.reduce((total, part) => total + part.weight, 0)).toBeCloseTo(1, 10);
  });
});
