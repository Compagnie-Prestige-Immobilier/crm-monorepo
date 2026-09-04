import { describe, expect, it } from 'vitest';

import {
  ACTIVITY_COLUMNS,
  activityLines,
  activityTotals,
  type ActivityRow,
  type SupervisionActivity,
} from './admin';

const LIGNE: ActivityRow = {
  bucket: '2026-08-17',
  teleconseillerId: 'awa',
  teleconseillerName: 'Awa Ba',
  calls: 0,
  confirmedCalls: 0,
  detectedCalls: 0,
  unloggedCalls: 0,
  avgCallSeconds: null,
  unreachable: 0,
  wrongNumber: 0,
  refused: 0,
  other: 0,
  methodObtained: 0,
  callback: 0,
  reachRate: null,
  prospectsCreated: 0,
  representantsContacted: 0,
  repCalls: 0,
  repConfirmedCalls: 0,
  repDetectedCalls: 0,
  repUnloggedCalls: 0,
  repAvgCallSeconds: null,
  repWrongNumber: 0,
  repReached: 0,
  repCallback: 0,
  repUnreachable: 0,
  repOther: 0,
  repContactRate: null,
  repCallbackRate: null,
  repQuestioned: 0,
  repQualified: 0,
  repQualificationRate: null,
  inboundCalls: 0,
  missedCalls: 0,
  callbacksHonored: 0,
  callbacksLate: 0,
  callbacksUpcoming: 0,
  repCallbacksHonored: 0,
  repCallbacksLate: 0,
  repCallbacksUpcoming: 0,
};

const reponse = (items: ActivityRow[]): SupervisionActivity =>
  ({
    from: null,
    to: null,
    granularity: 'day',
    totals: LIGNE,
    items,
    teleconseillers: [{ id: 'awa', fullName: 'Awa Ba', isActive: true }],
    scores: [],
    prospectsByTeleconseiller: [],
    prospectsByRepresentant: [],
    repQualificationStatuses: null,
  }) as unknown as SupervisionActivity;

describe('durée moyenne d’un appel, agrégée', () => {
  // Deux journées de volumes très différents : la moyenne des moyennes donnerait
  // 60 s, ce que personne n'a passé au téléphone.
  const jours = [
    { ...LIGNE, bucket: '2026-08-17', calls: 9, confirmedCalls: 9, avgCallSeconds: 100 },
    { ...LIGNE, bucket: '2026-08-18', calls: 1, confirmedCalls: 1, avgCallSeconds: 20 },
  ];

  it('pondère par le nombre d’appels confirmés, jamais par le nombre de lignes', () => {
    const [ligne] = activityLines(reponse(jours));

    expect(ligne?.confirmedCalls).toBe(10);
    expect(ligne?.avgCallSeconds).toBe(92);
  });

  it('reste sans objet quand aucun appel n’a été retrouvé au journal', () => {
    const [ligne] = activityLines(reponse([{ ...LIGNE, calls: 4 }]));

    expect(ligne?.avgCallSeconds).toBeNull();
  });

  it('vaut la même chose sur le total d’équipe', () => {
    const totals = activityTotals(activityLines(reponse(jours)));

    expect(totals.avgCallSeconds).toBe(92);
  });
});

describe('appels vus par le téléphone, dans les colonnes', () => {
  it('additionne les détections et celles que rien ne consigne', () => {
    const [ligne] = activityLines(
      reponse([
        { ...LIGNE, detectedCalls: 3, unloggedCalls: 2, repDetectedCalls: 1, repUnloggedCalls: 1 },
        { ...LIGNE, bucket: '2026-08-18', detectedCalls: 2, unloggedCalls: 0 },
      ]),
    );

    expect(ligne?.detectedCalls).toBe(5);
    expect(ligne?.unloggedCalls).toBe(2);
    expect(ligne?.repDetectedCalls).toBe(1);
    expect(ligne?.repUnloggedCalls).toBe(1);
  });

  it('les deux familles portent leurs colonnes de détection et de durée', () => {
    for (const famille of ['prospects', 'representants'] as const) {
      const libelles = ACTIVITY_COLUMNS[famille].map((colonne) => colonne.label);
      expect(libelles).toContain('Détectés');
      expect(libelles).toContain('Non consignés');
      expect(libelles).toContain('Durée moy.');
      expect(libelles).toContain('Rappels en retard');
    }
  });
});
