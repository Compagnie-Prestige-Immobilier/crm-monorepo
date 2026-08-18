import { describe, expect, it } from 'vitest';

import { DAKAR_TIME_ZONE, formatDakarDate, toDakarCell } from './dakar.js';

const expected = (date: Date): string =>
  new Intl.DateTimeFormat('sv-SE', {
    timeZone: DAKAR_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
    .format(date)
    .replace(' ', 'T');

describe('horodatage du classeur', () => {
  it('écrit l’heure murale de Dakar, pas l’instant UTC brut', () => {
    for (const iso of [
      '2026-08-12T09:30:00.000Z',
      '2026-01-01T00:00:00.000Z',
      '2026-06-30T23:59:59.000Z',
      '2026-12-31T22:15:00.000Z',
    ]) {
      const cell = toDakarCell(new Date(iso));
      expect(cell.toISOString().slice(0, 19)).toBe(expected(new Date(iso)));
    }
  });

  it('reste un vrai Date, pour qu’Excel puisse trier et filtrer la colonne', () => {
    expect(toDakarCell(new Date('2026-08-12T09:30:00.000Z'))).toBeInstanceOf(Date);
  });

  it('conserve l’ordre chronologique', () => {
    const early = toDakarCell(new Date('2026-08-12T08:00:00.000Z'));
    const late = toDakarCell(new Date('2026-08-12T18:00:00.000Z'));
    expect(early.getTime()).toBeLessThan(late.getTime());
  });

  it('minuit s’écrit 00 et non 24', () => {
    expect(toDakarCell(new Date('2026-03-01T00:00:00.000Z')).toISOString()).toContain('T00:00:00');
  });

  it('nomme le fichier avec la date de Dakar', () => {
    expect(formatDakarDate(new Date('2026-08-12T23:45:00.000Z'))).toBe('2026-08-12');
  });
});
