import { describe, expect, it } from 'vitest';

import { cubicBezier, easeOut, easeSpring, interpolateCount } from '@/lib/motion';

describe('cubic-bezier', () => {
  it('reste borné aux extrémités', () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(-1)).toBe(0);
    expect(easeOut(2)).toBe(1);
  });

  it('rend la diagonale pour la courbe linéaire', () => {
    const linear = cubicBezier(1 / 3, 1 / 3, 2 / 3, 2 / 3);
    for (const t of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      expect(linear(t)).toBeCloseTo(t, 5);
    }
  });

  it('freine à la fin, comme un ease-out', () => {
    expect(easeOut(0.22)).toBeGreaterThan(0.5);
    expect(easeOut(0.9)).toBeGreaterThan(0.98);
  });

  it('progresse toujours', () => {
    let previous = -1;
    for (let step = 0; step <= 100; step += 1) {
      const value = easeOut(step / 100);
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });

  it('dépasse la cible avant d’y revenir, pour la courbe à rebond', () => {
    const peak = Math.max(...Array.from({ length: 101 }, (_, i) => easeSpring(i / 100)));
    expect(peak).toBeGreaterThan(1);
    expect(easeSpring(1)).toBe(1);
  });
});

describe('interpolation d’un compteur', () => {
  it('part de la valeur d’origine et arrive à la cible', () => {
    expect(interpolateCount(1204, 1207, 0)).toBe(1204);
    expect(interpolateCount(1204, 1207, 1)).toBe(1207);
  });

  it('rend des entiers, jamais des décimales', () => {
    for (let step = 0; step <= 20; step += 1) {
      expect(Number.isInteger(interpolateCount(0, 7, step / 20))).toBe(true);
    }
  });

  it('reste monotone en descente comme en montée', () => {
    let previous = 1000;
    for (let step = 1; step <= 20; step += 1) {
      const value = interpolateCount(1000, 900, step / 20);
      expect(value).toBeLessThanOrEqual(previous);
      previous = value;
    }
  });

  it('borne une progression aberrante au lieu de dépasser', () => {
    expect(interpolateCount(10, 20, -0.5)).toBe(10);
    expect(interpolateCount(10, 20, 1.5)).toBe(20);
  });

  it('ne bouge pas quand la valeur ne change pas', () => {
    expect(interpolateCount(42, 42, 0.5)).toBe(42);
  });
});
