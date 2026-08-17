import { describe, expect, it } from 'vitest';

import { DAKAR_UTC_OFFSET, dakarLocalToIso, formatDakarDateTime } from '@/lib/format';

describe('dakarLocalToIso', () => {
  it('lit l’heure saisie comme une heure de DAKAR, jamais du poste', () => {
    expect(dakarLocalToIso('2026-08-20T09:00')).toBe('2026-08-20T09:00:00.000Z');
  });

  it('donne le même résultat quel que soit le fuseau du poste', () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = 'Europe/Paris';
      const paris = dakarLocalToIso('2026-08-20T09:00');
      process.env.TZ = 'Africa/Dakar';
      const dakar = dakarLocalToIso('2026-08-20T09:00');
      expect(paris).toBe(dakar);
      expect(paris).toBe('2026-08-20T09:00:00.000Z');
    } finally {
      process.env.TZ = original;
    }
  });

  it('accepte les secondes que certains navigateurs ajoutent', () => {
    expect(dakarLocalToIso('2026-08-20T09:00:30')).toBe('2026-08-20T09:00:30.000Z');
  });

  it('rend null plutôt qu’une date invalide qui traverserait le réseau', () => {
    expect(dakarLocalToIso('')).toBeNull();
    expect(dakarLocalToIso('20/08/2026 09:00')).toBeNull();
    expect(dakarLocalToIso('2026-08-20')).toBeNull();
    expect(dakarLocalToIso('2026-13-40T99:99')).toBeNull();
  });

  it('fixe le décalage du Sénégal, qui n’observe pas l’heure d’été', () => {
    expect(DAKAR_UTC_OFFSET).toBe('+00:00');
    expect(dakarLocalToIso('2026-01-15T09:00')).toBe('2026-01-15T09:00:00.000Z');
    expect(dakarLocalToIso('2026-08-15T09:00')).toBe('2026-08-15T09:00:00.000Z');
  });
});

describe('formatDakarDateTime', () => {
  it('rend l’heure SAISIE, et nomme le fuseau', () => {
    expect(formatDakarDateTime('2026-08-20T09:00')).toBe('20/08/2026 à 09:00 (heure de Dakar)');
  });

  it('rend null sur une saisie incomplète, pour ne rien afficher de faux', () => {
    expect(formatDakarDateTime('')).toBeNull();
  });
});
