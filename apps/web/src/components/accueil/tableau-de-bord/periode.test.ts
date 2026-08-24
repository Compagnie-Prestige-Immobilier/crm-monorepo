import { describe, expect, it } from 'vitest';

import {
  joursDansPlage,
  plageAnneePrecedente,
  plageDuPreset,
  plagePrecedente,
  plageTropLarge,
} from '@/components/accueil/tableau-de-bord/periode';

describe('3 derniers mois', () => {
  it('traverse un changement d’année', () => {
    const plage = plageDuPreset('trois-mois', new Date('2026-01-15T00:00:00Z'));
    expect(plage).toEqual({ du: '2025-11-01', au: '2026-01-31' });
  });

  it('reste correcte quand la référence est le 29 février', () => {
    const plage = plageDuPreset('trois-mois', new Date('2024-02-29T00:00:00Z'));
    expect(plage).toEqual({ du: '2023-12-01', au: '2024-02-29' });
  });
});

describe('plage précédente', () => {
  it('recule d’une plage de même longueur, sans chevauchement', () => {
    const precedente = plagePrecedente({ du: '2026-02-01', au: '2026-02-28' });
    expect(precedente).toEqual({ du: '2026-01-04', au: '2026-01-31' });
    expect(joursDansPlage(precedente)).toBe(joursDansPlage({ du: '2026-02-01', au: '2026-02-28' }));
  });
});

describe('plage de l’an dernier', () => {
  it('recule d’un an jour pour jour', () => {
    expect(plageAnneePrecedente({ du: '2026-02-01', au: '2026-02-28' })).toEqual({
      du: '2025-02-01',
      au: '2025-02-28',
    });
  });

  it('se rabat sur le 28 février pour un 29 février qui n’existe pas l’an dernier', () => {
    expect(plageAnneePrecedente({ du: '2024-02-29', au: '2024-02-29' })).toEqual({
      du: '2023-02-28',
      au: '2023-02-28',
    });
  });
});

describe('la limite de 400 jours', () => {
  it('accepte exactement 400 jours', () => {
    const plage = { du: '2025-01-01', au: '2026-02-04' };
    expect(joursDansPlage(plage)).toBe(400);
    expect(plageTropLarge(plage)).toBe(false);
  });

  it('refuse 401 jours', () => {
    const plage = { du: '2025-01-01', au: '2026-02-05' };
    expect(joursDansPlage(plage)).toBe(401);
    expect(plageTropLarge(plage)).toBe(true);
  });
});
