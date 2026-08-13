import { describe, expect, it } from 'vitest';

import {
  PRESENCE_LABELS,
  canSubmitPurge,
  expandSelection,
  formatElapsed,
  impliedDomains,
  matchesHint,
  minutesSince,
  selectionRows,
  type PurgeCatalog,
  type PurgeDomain,
} from '@/lib/data/admin';

/**
 * L'écran de purge ne se teste pas au clic : ce qu'il faut protéger, c'est la
 * décision — quels domaines sont entraînés, combien de lignes cela fait, et
 * quand le bouton part.
 */

const DOMAINS: PurgeDomain[] = [
  { key: 'dossiers', label: 'Dossiers bancaires', hint: '', requires: [], rows: 12 },
  { key: 'tentatives', label: 'Tentatives d’appel', hint: '', requires: [], rows: 40 },
  { key: 'fileAppels', label: 'File d’appels', hint: '', requires: [], rows: 30 },
  {
    key: 'prospects',
    label: 'Prospects',
    hint: '',
    requires: ['dossiers', 'tentatives', 'fileAppels'],
    rows: 100,
  },
  { key: 'representants', label: 'Représentants', hint: '', requires: ['prospects'], rows: 7 },
  { key: 'journal', label: 'Journal d’audit', hint: '', requires: [], rows: 3 },
];

function catalog(overrides: Partial<PurgeCatalog> = {}): PurgeCatalog {
  return { allowed: true, confirmationHint: 'direction', domains: DOMAINS, ...overrides };
}

describe('fermeture de la sélection', () => {
  it('entraîne les dépendances transitivement', () => {
    expect(expandSelection(['representants'], DOMAINS)).toEqual([
      'dossiers',
      'tentatives',
      'fileAppels',
      'prospects',
      'representants',
    ]);
  });

  it('rend le même ordre quel que soit l’ordre des clics', () => {
    expect(expandSelection(['prospects', 'journal'], DOMAINS)).toEqual(
      expandSelection(['journal', 'prospects'], DOMAINS),
    );
  });

  it('laisse un domaine feuille seul', () => {
    expect(expandSelection(['journal'], DOMAINS)).toEqual(['journal']);
  });

  it('est idempotente', () => {
    const once = expandSelection(['representants'], DOMAINS);
    expect(expandSelection(once, DOMAINS)).toEqual(once);
  });

  it('ne rend rien pour une sélection vide', () => {
    expect(expandSelection([], DOMAINS)).toEqual([]);
  });
});

describe('domaines entraînés', () => {
  it('exclut ceux que l’administrateur a cochés lui-même', () => {
    expect(impliedDomains(['representants'], DOMAINS)).toEqual([
      'dossiers',
      'tentatives',
      'fileAppels',
      'prospects',
    ]);
  });

  it('ne signale rien quand tout a été coché à la main', () => {
    expect(impliedDomains(['journal'], DOMAINS)).toEqual([]);
  });
});

describe('lignes concernées', () => {
  it('additionne la sélection étendue, sans double compte', () => {
    // 7 + 100 + 12 + 40 + 30
    expect(selectionRows(['representants'], DOMAINS)).toBe(189);
  });

  it('ne compte pas deux fois un domaine coché ET entraîné', () => {
    expect(selectionRows(['representants', 'prospects', 'dossiers'], DOMAINS)).toBe(189);
  });

  it('rend zéro sans sélection', () => {
    expect(selectionRows([], DOMAINS)).toBe(0);
  });
});

describe('ressaisie de l’identifiant', () => {
  it('accepte la casse et les espaces de bord', () => {
    expect(matchesHint('  Direction ', 'direction')).toBe(true);
  });

  it('refuse une chaîne vide, même face à un indice vide', () => {
    expect(matchesHint('', '')).toBe(false);
    expect(matchesHint('   ', 'direction')).toBe(false);
  });

  it('refuse un identifiant approchant', () => {
    expect(matchesHint('directio', 'direction')).toBe(false);
    expect(matchesHint('direction2', 'direction')).toBe(false);
  });
});

describe('conditions d’envoi', () => {
  const base = { catalog: catalog(), selected: ['journal'] as const, confirmation: 'direction' };

  it('part quand les quatre conditions sont réunies', () => {
    expect(canSubmitPurge({ ...base, pending: false })).toBe(true);
  });

  it('ne part pas pour un administrateur non habilité', () => {
    expect(
      canSubmitPurge({ ...base, catalog: catalog({ allowed: false }), pending: false }),
    ).toBe(false);
  });

  it('ne part pas sans domaine coché', () => {
    expect(canSubmitPurge({ ...base, selected: [], pending: false })).toBe(false);
  });

  it('ne part pas sans ressaisie correcte', () => {
    expect(canSubmitPurge({ ...base, confirmation: 'oui', pending: false })).toBe(false);
  });

  it('bloque le second clic pendant l’appel', () => {
    expect(canSubmitPurge({ ...base, pending: true })).toBe(false);
  });
});

describe('présence', () => {
  const observed = '2026-08-13T10:00:00.000Z';

  it('mesure l’écart contre l’horloge du serveur', () => {
    expect(minutesSince('2026-08-13T09:47:00.000Z', observed)).toBe(13);
  });

  it('ramène une trace en avance à zéro', () => {
    // Horloge d'appareil décalée : jamais « dans 5 minutes ».
    expect(minutesSince('2026-08-13T10:05:00.000Z', observed)).toBe(0);
  });

  it('rend null sans trace', () => {
    expect(minutesSince(null, observed)).toBeNull();
  });

  it('rend null sur une date illisible', () => {
    expect(minutesSince('hier', observed)).toBeNull();
  });

  it('change d’unité aux seuils où le chiffre cesse de parler', () => {
    expect(formatElapsed(null)).toBe('Jamais');
    expect(formatElapsed(0)).toBe('À l’instant');
    expect(formatElapsed(1)).toBe('1 min');
    expect(formatElapsed(59)).toBe('59 min');
    expect(formatElapsed(60)).toBe('1 h');
    expect(formatElapsed(1439)).toBe('23 h');
    expect(formatElapsed(1440)).toBe('1 j');
    expect(formatElapsed(4320)).toBe('3 j');
  });

  it('nomme chaque état sans le raconter', () => {
    expect(PRESENCE_LABELS).toEqual({
      ONLINE: 'Connecté',
      RECENT: 'Récent',
      AWAY: 'Inactif',
    });
  });
});
