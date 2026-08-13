import { describe, expect, it } from 'vitest';

import {
  PRESENCE_ONLINE_WINDOW_MINUTES,
  PRESENCE_RECENT_WINDOW_HOURS,
  countByPresence,
  lastSeenAt,
  presenceOf,
  type ActivitySignals,
} from './presence.js';

const NOW = new Date('2026-08-13T10:00:00.000Z');

function minutesAgo(minutes: number): Date {
  return new Date(NOW.getTime() - minutes * 60_000);
}

function signals(overrides: Partial<ActivitySignals> = {}): ActivitySignals {
  return {
    isActive: true,
    hasLiveSession: true,
    lastLoginAt: null,
    lastTokenAt: null,
    lastSyncAt: null,
    lastWriteAt: null,
    ...overrides,
  };
}

describe('dernière trace', () => {
  it('prend la plus récente, toutes sources confondues', () => {
    const seen = lastSeenAt(
      signals({
        lastLoginAt: minutesAgo(600),
        lastTokenAt: minutesAgo(12),
        lastSyncAt: minutesAgo(3),
        lastWriteAt: minutesAgo(45),
      }),
    );
    expect(seen).toEqual(minutesAgo(3));
  });

  it('ne retient pas une source absente', () => {
    expect(lastSeenAt(signals({ lastWriteAt: minutesAgo(90) }))).toEqual(minutesAgo(90));
  });

  it('rend null quand rien n’a jamais été observé', () => {
    expect(lastSeenAt(signals())).toBeNull();
  });
});

describe('état de présence', () => {
  it('annonce connecté sous la fenêtre, session vivante à l’appui', () => {
    expect(presenceOf(signals({ lastTokenAt: minutesAgo(4) }), NOW)).toBe('ONLINE');
  });

  it('tient la borne exacte de la fenêtre', () => {
    expect(
      presenceOf(signals({ lastTokenAt: minutesAgo(PRESENCE_ONLINE_WINDOW_MINUTES) }), NOW),
    ).toBe('ONLINE');
    expect(
      presenceOf(signals({ lastTokenAt: minutesAgo(PRESENCE_ONLINE_WINDOW_MINUTES + 1) }), NOW),
    ).toBe('RECENT');
  });

  it('n’annonce pas connecté sans session vivante, même sur une trace fraîche', () => {
    // Compte déconnecté à l'instant : la trace est fraîche, la session est morte.
    expect(presenceOf(signals({ hasLiveSession: false, lastWriteAt: minutesAgo(2) }), NOW)).toBe(
      'RECENT',
    );
  });

  it('n’annonce pas connecté un compte désactivé', () => {
    expect(presenceOf(signals({ isActive: false, lastTokenAt: minutesAgo(2) }), NOW)).toBe(
      'RECENT',
    );
  });

  it('n’annonce pas connecté une session dormante sans trace fraîche', () => {
    // Un onglet fermé garde un jeton valable trente jours : la session vit,
    // l'utilisateur non.
    expect(presenceOf(signals({ lastTokenAt: minutesAgo(180) }), NOW)).toBe('RECENT');
  });

  it('bascule de récent à inactif au bout de la seconde fenêtre', () => {
    const hours = PRESENCE_RECENT_WINDOW_HOURS;
    expect(presenceOf(signals({ lastWriteAt: minutesAgo(hours * 60) }), NOW)).toBe('RECENT');
    expect(presenceOf(signals({ lastWriteAt: minutesAgo(hours * 60 + 1) }), NOW)).toBe('AWAY');
  });

  it('range un compte sans aucune trace en inactif', () => {
    expect(presenceOf(signals(), NOW)).toBe('AWAY');
  });

  it('ne prend pas une horloge en avance pour une présence', () => {
    // Trace « dans le futur » : horloge d'un appareil décalée. On ne la compte
    // pas comme une présence, sans quoi un téléphone mal réglé afficherait son
    // porteur connecté en permanence.
    const future = new Date(NOW.getTime() + 30 * 60_000);
    expect(presenceOf(signals({ lastTokenAt: future }), NOW)).toBe('RECENT');
  });
});

describe('compteurs de tête', () => {
  it('compte chaque état, y compris ceux à zéro', () => {
    expect(countByPresence(['ONLINE', 'ONLINE', 'AWAY'])).toEqual({
      ONLINE: 2,
      RECENT: 0,
      AWAY: 1,
    });
  });

  it('rend trois zéros pour une liste vide', () => {
    expect(countByPresence([])).toEqual({ ONLINE: 0, RECENT: 0, AWAY: 0 });
  });
});
