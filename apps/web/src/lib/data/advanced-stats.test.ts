import { describe, expect, it } from 'vitest';

import { formatDelayDays } from '@/lib/data/advanced-stats';

describe('formatDelayDays', () => {
  it('distingue « aucune mesure » de « zéro jour »', () => {
    expect(formatDelayDays(null)).toBe('Aucune mesure');
    expect(formatDelayDays(0)).toBe('Moins d’un jour');
  });

  it('arrondit au dixième de journée', () => {
    expect(formatDelayDays(12.34)).toBe('12.3 j');
  });
});
