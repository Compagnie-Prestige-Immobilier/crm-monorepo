import { describe, expect, it } from 'vitest';

import { inclusiveDateFrom, inclusiveDateTo } from './date-bounds.js';

describe('bornes de date incluses', () => {
  it('une date nue en borne haute couvre la journée entière', () => {
    const bound = inclusiveDateTo('2026-08-13');

    expect(bound.toISOString()).toBe('2026-08-13T23:59:59.999Z');
    expect(new Date('2026-08-13T17:30:00.000Z').getTime()).toBeLessThanOrEqual(bound.getTime());
    expect(new Date('2026-08-14T00:00:00.000Z').getTime()).toBeGreaterThan(bound.getTime());
  });

  it('une date nue en borne basse part du premier instant de la journée', () => {
    const bound = inclusiveDateFrom('2026-08-13');

    expect(bound.toISOString()).toBe('2026-08-13T00:00:00.000Z');
    expect(new Date('2026-08-13T00:00:00.000Z').getTime()).toBeGreaterThanOrEqual(bound.getTime());
  });

  it('un instant complet n’est pas déplacé', () => {
    expect(inclusiveDateTo('2026-08-13T14:30:00.000Z').toISOString()).toBe(
      '2026-08-13T14:30:00.000Z',
    );
    expect(inclusiveDateFrom('2026-08-13T14:30:00.000Z').toISOString()).toBe(
      '2026-08-13T14:30:00.000Z',
    );
  });

  it('la journée est celle de Dakar, quel que soit le fuseau du serveur', () => {
    const janvier = inclusiveDateTo('2026-01-15');
    const juillet = inclusiveDateTo('2026-07-15');

    expect(janvier.toISOString()).toBe('2026-01-15T23:59:59.999Z');
    expect(juillet.toISOString()).toBe('2026-07-15T23:59:59.999Z');
  });
});
