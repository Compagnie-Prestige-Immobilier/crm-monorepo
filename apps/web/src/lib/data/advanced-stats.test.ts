import { describe, expect, it } from 'vitest';

import {
  closedPerCommercial,
  closedPerDayTotals,
  estimatedEndLabel,
  formatDelayDays,
} from '@/lib/data/advanced-stats';

const ROWS = [
  { day: '2026-08-10', commercialId: 'c1', commercialName: 'Aminata', done: 12 },
  { day: '2026-08-10', commercialId: 'c2', commercialName: 'Moussa', done: 8 },
  { day: '2026-08-11', commercialId: 'c1', commercialName: 'Aminata', done: 5 },
] as const;

describe('closedPerDayTotals', () => {
  it('replie les commerciaux et garde les jours dans l’ordre', () => {
    expect(closedPerDayTotals(ROWS)).toEqual([
      { day: '2026-08-10', done: 20 },
      { day: '2026-08-11', done: 5 },
    ]);
  });

  it('rend une série vide sans donnée, jamais une ligne à zéro', () => {
    expect(closedPerDayTotals([])).toEqual([]);
  });
});

describe('closedPerCommercial', () => {
  it('cumule les journées et classe du plus avancé au moins avancé', () => {
    expect(closedPerCommercial(ROWS)).toEqual([
      { id: 'c1', label: 'Aminata', value: 17 },
      { id: 'c2', label: 'Moussa', value: 8 },
    ]);
  });
});

describe('formatDelayDays', () => {
  it('distingue « aucune mesure » de « zéro jour »', () => {
    expect(formatDelayDays(null)).toBe('Aucune mesure');
    expect(formatDelayDays(0)).toBe('Moins d’un jour');
  });

  it('arrondit au dixième de journée', () => {
    expect(formatDelayDays(12.34)).toBe('12.3 j');
  });
});

describe('estimatedEndLabel', () => {
  it('ne promet pas de date quand la campagne est à l’arrêt', () => {
    expect(estimatedEndLabel(null, 400)).toBe('Aucune cadence observée');
  });

  it('dit que tout est traité plutôt que d’afficher une date passée', () => {
    expect(estimatedEndLabel('2026-08-01', 0)).toBe('Tout est traité');
  });

  it('rend la date projetée quand elle a du sens', () => {
    expect(estimatedEndLabel('2026-09-02', 400)).toBe('2026-09-02');
  });
});
