import { describe, expect, it } from 'vitest';

import {
  PRESENCE_LABELS,
  activityAverages,
  activityCsv,
  activityCsvFileName,
  activityLines,
  activityTotals,
  bucketTotals,
  canSubmitPurge,
  expandSelection,
  formatElapsed,
  impliedDomains,
  knownPresence,
  knownRole,
  matchesHint,
  dakarToday,
  minutesSince,
  presetRange,
  selectionRows,
  sortActivityLines,
  type ActivityLine,
  type ActivityRow,
  type PurgeCatalog,
  type PurgeDomain,
  type SupervisionActivity,
} from '@/lib/data/admin';

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
    expect(canSubmitPurge({ ...base, catalog: catalog({ allowed: false }), pending: false })).toBe(
      false,
    );
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

describe('un rôle ou un état inconnu ne fait PAS tomber la Supervision', () => {
  it('replie un rôle inconnu sur le rôle de terrain, sans lever', () => {
    expect(() => knownRole('SUPERVISEUR_REGIONAL')).not.toThrow();
    expect(knownRole('SUPERVISEUR_REGIONAL')).toBe('COMMERCIAL');
  });

  it('conserve évidemment les rôles connus', () => {
    expect(knownRole('ADMIN')).toBe('ADMIN');
    expect(knownRole('BANQUE_FINANCE')).toBe('BANQUE_FINANCE');
    expect(knownRole('COMMERCIAL')).toBe('COMMERCIAL');
  });

  it('replie une présence inconnue sur l’état le moins affirmatif', () => {
    expect(knownPresence('EN_PAUSE')).toBe('AWAY');
    expect(knownPresence('ONLINE')).toBe('ONLINE');
    expect(knownPresence('RECENT')).toBe('RECENT');
  });

  it('rend une valeur toujours affichable, donc jamais un libellé vide', () => {
    expect(PRESENCE_LABELS[knownPresence('QUOI_QUE_CE_SOIT')]).toBe('Inactif');
  });
});

const ALICE = '11111111-1111-1111-1111-111111111111';
const BINETA = '22222222-2222-2222-2222-222222222222';

function activity(overrides: Partial<SupervisionActivity> = {}): SupervisionActivity {
  return {
    from: '2026-08-17T00:00:00.000Z',
    to: '2026-08-17T23:59:59.999Z',
    granularity: 'day',
    items: [],
    teleconseillers: [
      { id: ALICE, fullName: 'Alice Diop', isActive: true, openTasks: 1 },
      { id: BINETA, fullName: 'Bineta Fall', isActive: true, openTasks: 4 },
    ],
    ...overrides,
  };
}

function row(overrides: Partial<ActivityRow> = {}): ActivityRow {
  return {
    bucket: '2026-08-17',
    teleconseillerId: ALICE,
    teleconseillerName: 'Alice Diop',
    calls: 4,
    unreachable: 1,
    wrongNumber: 1,
    refused: 1,
    other: 0,
    methodObtained: 1,
    callback: 0,
    reachRate: 50,
    prospectsCreated: 2,
    representantsContacted: 2,
    tasksClosed: 1,
    ...overrides,
  };
}

describe('croisement des actes et de la liste des téléconseillers', () => {
  it('garde le téléconseiller sans aucun acte, à zéro', () => {
    const lines = activityLines(activity({ items: [row()] }));

    expect(lines.map((line) => line.name)).toEqual(['Alice Diop', 'Bineta Fall']);
    const bineta = lines.find((line) => line.id === BINETA);
    expect(bineta?.calls).toBe(0);
    expect(bineta?.hasActivity).toBe(false);
    expect(bineta?.openTasks).toBe(4);
  });

  it('additionne les périodes d’un même téléconseiller', () => {
    const lines = activityLines(
      activity({
        items: [
          row(),
          row({ bucket: '2026-08-18', calls: 6, unreachable: 2, prospectsCreated: 3 }),
        ],
      }),
    );

    const alice = lines.find((line) => line.id === ALICE);
    expect(alice?.calls).toBe(10);
    expect(alice?.prospectsCreated).toBe(5);
  });

  it('n’efface pas un acte dont l’auteur ne figure plus dans la liste', () => {
    const lines = activityLines(
      activity({
        teleconseillers: [],
        items: [row({ teleconseillerId: 'zzz', teleconseillerName: 'Ancien compte' })],
      }),
    );

    expect(lines.map((line) => line.name)).toEqual(['Ancien compte']);
    expect(lines[0]?.calls).toBe(4);
  });
});

describe('taux de joignabilité recalculé sur la période', () => {
  it('vaut null sans aucun appel, jamais 0', () => {
    const lines = activityLines(activity({ items: [row()] }));

    expect(lines.find((line) => line.id === BINETA)?.reachRate).toBeNull();
  });

  it('vaut 0 quand tous les appels ont échoué', () => {
    const lines = activityLines(
      activity({ items: [row({ calls: 3, unreachable: 2, wrongNumber: 1 })] }),
    );

    expect(lines.find((line) => line.id === ALICE)?.reachRate).toBe(0);
  });

  it('se recalcule sur le cumul, au lieu de moyenner les taux des périodes', () => {
    const lines = activityLines(
      activity({
        items: [
          row({ calls: 2, unreachable: 0, wrongNumber: 0 }),
          row({ bucket: '2026-08-18', calls: 8, unreachable: 8, wrongNumber: 0 }),
        ],
      }),
    );

    expect(lines.find((line) => line.id === ALICE)?.reachRate).toBe(20);
  });
});

describe('totaux et moyenne d’équipe', () => {
  it('somme les colonnes et recalcule le taux sur le total', () => {
    const lines = activityLines(
      activity({
        items: [row(), row({ teleconseillerId: BINETA, teleconseillerName: 'Bineta Fall' })],
      }),
    );
    const totals = activityTotals(lines);

    expect(totals.people).toBe(2);
    expect(totals.calls).toBe(8);
    expect(totals.unreachable).toBe(2);
    expect(totals.openTasks).toBe(5);
    expect(totals.reachRate).toBe(50);
  });

  it('divise la moyenne par le nombre de téléconseillers, y compris ceux à zéro', () => {
    const lines = activityLines(activity({ items: [row({ calls: 5 })] }));
    const averages = activityAverages(activityTotals(lines));

    expect(averages.calls).toBe(2.5);
  });

  it('ne divise pas par zéro sans aucun téléconseiller', () => {
    const averages = activityAverages(activityTotals([]));

    expect(averages.calls).toBe(0);
  });
});

describe('regroupement par période', () => {
  it('agrège les téléconseillers dans chaque seau, dans l’ordre chronologique', () => {
    const buckets = bucketTotals([
      row({ bucket: '2026-08-18', calls: 1, unreachable: 0, wrongNumber: 0 }),
      row({ bucket: '2026-08-17' }),
      row({ bucket: '2026-08-17', teleconseillerId: BINETA, calls: 2, unreachable: 2 }),
    ]);

    expect(buckets.map((bucket) => bucket.bucket)).toEqual(['2026-08-17', '2026-08-18']);
    expect(buckets[0]?.calls).toBe(6);
    expect(buckets[0]?.reachRate).toBe(16.7);
  });
});

describe('fenêtre de dates, journée de Dakar', () => {
  it('prend la journée en cours pour « Aujourd’hui »', () => {
    expect(presetRange('today', '2026-08-17')).toEqual({ from: '2026-08-17', to: '2026-08-17' });
  });

  it('démarre la semaine au lundi', () => {
    expect(presetRange('week', '2026-08-20')).toEqual({ from: '2026-08-17', to: '2026-08-20' });
    expect(presetRange('week', '2026-08-16')).toEqual({ from: '2026-08-10', to: '2026-08-16' });
  });

  it('compte sept jours, aujourd’hui inclus', () => {
    expect(presetRange('last7', '2026-08-17')).toEqual({ from: '2026-08-11', to: '2026-08-17' });
  });

  it('lit la date de Dakar, qui est celle d’UTC', () => {
    expect(dakarToday(new Date('2026-08-17T23:30:00.000Z'))).toBe('2026-08-17');
  });
});

describe('tri du tableau', () => {
  const lines = activityLines(
    activity({
      items: [row({ calls: 4 }), row({ teleconseillerId: BINETA, calls: 9, unreachable: 0 })],
    }),
  );

  it('classe les chiffres du plus grand au plus petit', () => {
    expect(sortActivityLines(lines, 'calls', 'desc').map((line) => line.id)).toEqual([
      BINETA,
      ALICE,
    ]);
  });

  it('renvoie le taux absent en fin de liste, dans les deux sens', () => {
    const withoutCalls = activityLines(activity({ items: [row()] }));

    expect(sortActivityLines(withoutCalls, 'reachRate', 'desc').at(-1)?.id).toBe(BINETA);
    expect(sortActivityLines(withoutCalls, 'reachRate', 'asc').at(-1)?.id).toBe(BINETA);
  });
});

describe('export CSV de la fiche de monitoring', () => {
  const lines = activityLines(activity({ items: [row()] }));
  const csv = activityCsv({
    lines,
    totals: activityTotals(lines),
    range: { from: '2026-08-17', to: '2026-08-17' },
    granularity: 'day',
  });
  const rows = csv.split('\r\n');

  it('porte une ligne par téléconseiller, celui à zéro compris', () => {
    expect(rows.some((line) => line.startsWith('Alice Diop;4;'))).toBe(true);
    expect(rows.some((line) => line.startsWith('Bineta Fall;0;'))).toBe(true);
  });

  it('laisse la case du taux vide quand il n’existe pas, au lieu d’écrire 0', () => {
    const bineta = rows.find((line) => line.startsWith('Bineta Fall'))?.split(';');

    expect(bineta?.[7]).toBe('');
  });

  it('termine par le total et la moyenne', () => {
    expect(rows.some((line) => line.startsWith('Total équipe;4;'))).toBe(true);
    expect(rows.some((line) => line.startsWith('Moyenne par téléconseiller;2;'))).toBe(true);
  });

  it('protège un nom qui contient le séparateur', () => {
    const named = activityCsv({
      lines: [{ ...lines[0], name: 'Diop; Alice' } as ActivityLine],
      totals: activityTotals(lines),
      range: { from: '2026-08-17', to: '2026-08-17' },
      granularity: 'day',
    });

    expect(named).toContain('"Diop; Alice"');
  });

  it('nomme le fichier d’après la fenêtre', () => {
    expect(activityCsvFileName({ from: '2026-08-17', to: '2026-08-17' })).toBe(
      'cpi-supervision-activite-2026-08-17.csv',
    );
    expect(activityCsvFileName({ from: '2026-08-11', to: '2026-08-17' })).toBe(
      'cpi-supervision-activite-2026-08-11_2026-08-17.csv',
    );
  });
});
