import { Projet } from '@crm/database';
import { describe, expect, it } from 'vitest';

import { makeAnalyticsPrisma } from './fake-analytics-prisma.js';
import { SupervisionGranularity } from './supervision.dto.js';
import { SupervisionActivityService } from './supervision.service.js';

const ligne = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  jour: '2026-08-17',
  id: 'com-alice',
  nom: 'Alice Diop',
  appels: 0,
  injoignables: 0,
  faux: 0,
  refus: 0,
  autres: 0,
  methodes: 0,
  rappels: 0,
  joignables: 0,
  prospects: 0,
  representants: 0,
  taches: 0,
  ...over,
});

const ligneRep = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  jour: '2026-08-17',
  id: 'com-alice',
  appels: 0,
  joints: 0,
  rappels: 0,
  injoignables: 0,
  autres: 0,
  interroges: 0,
  qualifies: 0,
  ...over,
});

const AUCUN_REPRESENTANT = {
  repCalls: 0,
  repReached: 0,
  repCallback: 0,
  repUnreachable: 0,
  repOther: 0,
  repContactRate: null,
  repCallbackRate: null,
  repQuestioned: 0,
  repQualified: 0,
  repQualificationRate: null,
};

describe('activité des téléconseillers', () => {
  it('mesure la date de l’ACTE, jamais l’arrivée en base', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    await new SupervisionActivityService(service).activite({});

    expect(sql()).toContain('ca."clientCreatedAt"');
    expect(sql()).toContain('p."clientCreatedAt"');
    expect(sql()).toContain('rca."clientCreatedAt"');
    expect(sql()).toContain('ct."completedAt"');
    expect(sql()).not.toContain('ca."createdAt"');
  });

  it('borne la fenêtre sur la journée de Dakar, bornes incluses', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    await new SupervisionActivityService(service).activite({
      actFrom: '2026-08-17',
      actTo: '2026-08-17',
    });

    expect(sql()).toContain('"2026-08-17T00:00:00.000Z"');
    expect(sql()).toContain('"2026-08-17T23:59:59.999Z"');
  });

  it('sans fenêtre, aucune borne de date n’est posée', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    const result = await new SupervisionActivityService(service).activite({});

    expect(sql()).not.toContain('>=');
    expect(result.from).toBeNull();
    expect(result.to).toBeNull();
  });

  it('n’injecte jamais la granularité reçue dans le date_trunc', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    await new SupervisionActivityService(service).activite({
      granularity: SupervisionGranularity.WEEK,
    });

    expect(sql()).toContain("date_trunc('week'");
    expect(sql()).not.toContain('date_trunc("week"');
  });

  // L'encadrement appelle aussi : le borner au COMMERCIAL effaçait de l'écran
  // les appels d'un superviseur ou de la directrice commerciale.
  it('compte tout le plateau, encadrement compris, et l’ADMIN jamais', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    await new SupervisionActivityService(service).activite({});

    const texte = sql();
    expect(texte).toContain(
      'u."role" IN ("COMMERCIAL"::"Role","SUPERVISEUR"::"Role","DIRECTION"::"Role")',
    );
    expect(texte).not.toContain('"ADMIN"');
    expect(texte).toContain('u."deletedAt" IS NULL');
  });

  it('rend le détail par issue et le taux de joignabilité', async () => {
    const { service } = makeAnalyticsPrisma(
      [
        ligne({
          appels: 10,
          injoignables: 2,
          faux: 1,
          refus: 3,
          autres: 1,
          methodes: 2,
          rappels: 1,
          joignables: 7,
          prospects: 4,
          representants: 2,
          taches: 6,
        }),
      ],
      [],
      [],
      [],
      [{ id: 'com-alice', nom: 'Alice Diop', actif: true, ouvertes: 12 }],
    );

    const result = await new SupervisionActivityService(service).activite({});
    const row = result.items[0];

    expect(row).toEqual({
      bucket: '2026-08-17',
      teleconseillerId: 'com-alice',
      teleconseillerName: 'Alice Diop',
      calls: 10,
      unreachable: 2,
      wrongNumber: 1,
      refused: 3,
      other: 1,
      methodObtained: 2,
      callback: 1,
      reachRate: 70,
      prospectsCreated: 4,
      representantsContacted: 2,
      tasksClosed: 6,
      ...AUCUN_REPRESENTANT,
    });
    expect(result.teleconseillers).toEqual([
      { id: 'com-alice', fullName: 'Alice Diop', isActive: true, openTasks: 12 },
    ]);
  });

  it('aucun appel : le taux vaut null, jamais 0', async () => {
    const { service } = makeAnalyticsPrisma([ligne({ prospects: 3 })], [], []);
    const result = await new SupervisionActivityService(service).activite({});

    expect(result.items[0]?.calls).toBe(0);
    expect(result.items[0]?.reachRate).toBeNull();
  });

  it('base vide : charge utile complète, histogrammes compris', async () => {
    const { service, calls } = makeAnalyticsPrisma();
    const result = await new SupervisionActivityService(service).activite({});

    expect(calls()).toBe(7);
    expect(result.items).toEqual([]);
    expect(result.totals).toMatchObject({ calls: 0, reachRate: null, ...AUCUN_REPRESENTANT });
    expect(result.teleconseillers).toEqual([]);
    expect(result.prospectsByTeleconseiller).toEqual([]);
    expect(result.prospectsByRepresentant).toEqual([]);
    expect(result.granularity).toBe(SupervisionGranularity.DAY);
  });
});

describe('qualification des représentants', () => {
  it('rend le détail par issue et les deux taux d’appel', async () => {
    const { service } = makeAnalyticsPrisma(
      [ligne({ representants: 3 })],
      [
        ligneRep({
          appels: 4,
          joints: 2,
          rappels: 1,
          injoignables: 1,
          autres: 1,
          interroges: 2,
          qualifies: 1,
        }),
      ],
    );

    const row = (await new SupervisionActivityService(service).activite({})).items[0];

    expect(row?.repCalls).toBe(4);
    expect(row?.repReached).toBe(2);
    expect(row?.repCallback).toBe(1);
    expect(row?.repUnreachable).toBe(1);
    expect(row?.repOther).toBe(1);
    expect(row?.repContactRate).toBe(50);
    expect(row?.repCallbackRate).toBe(25);
    expect(row?.repQuestioned).toBe(2);
    expect(row?.repQualified).toBe(1);
    expect(row?.repQualificationRate).toBe(50);
  });

  it('les issues d’héritage sortent du dénominateur des taux', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    await new SupervisionActivityService(service).activite({});

    expect(sql()).toContain("('REACHED', 'REFUSED', 'CALLBACK', 'UNREACHABLE')");
    expect(sql()).not.toContain("'PROSPECTS_PROMISED'");
  });

  it('attribue le représentant à la DERNIÈRE réponse de la fenêtre', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    await new SupervisionActivityService(service).activite({});

    expect(sql()).toContain('DISTINCT ON (rca."representantId")');
    expect(sql()).toContain('ORDER BY rca."representantId", rca."clientCreatedAt" DESC');
    expect(sql()).toContain("rca.\"outcome\" IN ('REACHED', 'REFUSED')");
  });

  it('aucun appel représentant : les taux valent null, jamais 0', async () => {
    const { service } = makeAnalyticsPrisma([ligne({ appels: 3 })], []);
    const row = (await new SupervisionActivityService(service).activite({})).items[0];

    expect(row).toMatchObject(AUCUN_REPRESENTANT);
  });

  it('Grand Public : aucun représentant n’y existe, les trois branches sont coupées', async () => {
    const { service, queries } = makeAnalyticsPrisma();
    await new SupervisionActivityService(service).activite({ projet: Projet.GRAND_PUBLIC });

    const texte = queries().join('\n');
    const branches = texte.split('FROM "rep_call_attempts" rca').length - 1;

    expect(branches).toBeGreaterThan(0);
    expect(texte.split('FALSE').length - 1).toBe(branches);
  });

  it('le total d’équipe se lit sur les mêmes faits, sans regroupement', async () => {
    const { service, queries } = makeAnalyticsPrisma();
    await new SupervisionActivityService(service).activite({ commercialId: 'com-alice' });

    const totaux = queries().filter((requete) => !requete.includes('GROUP BY'));
    expect(totaux).toHaveLength(2);
    for (const requete of totaux) {
      expect(requete).toContain('IN (SELECT u."id" FROM "users" u WHERE');
      expect(requete).toContain('u."id" = "com-alice"');
    }
    expect(totaux[0]).toContain('COUNT(DISTINCT f.representant)');
    expect(totaux[1]).toContain('DISTINCT ON (rca."representantId")');
  });

  it('rend le total d’équipe, taux recalculés sur les sommes', async () => {
    const { service } = makeAnalyticsPrisma(
      [],
      [],
      [ligne({ appels: 10, joignables: 4, representants: 7 })],
      [ligneRep({ appels: 8, joints: 6, rappels: 2, interroges: 4, qualifies: 3 })],
    );

    const { totals } = await new SupervisionActivityService(service).activite({});

    expect(totals.calls).toBe(10);
    expect(totals.reachRate).toBe(40);
    expect(totals.representantsContacted).toBe(7);
    expect(totals.repCalls).toBe(8);
    expect(totals.repContactRate).toBe(75);
    expect(totals.repCallbackRate).toBe(25);
    expect(totals.repQuestioned).toBe(4);
    expect(totals.repQualified).toBe(3);
    expect(totals.repQualificationRate).toBe(75);
  });

  it('CHUES : les branches prospects passent par le parcours', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    await new SupervisionActivityService(service).activite({ projet: Projet.CHUES });

    expect(sql()).toContain('FROM "prospect_journeys" pj');
    expect(sql()).toContain('pj."prospectId" = ca."prospectId"');
    expect(sql()).toContain('pj."prospectId" = ct."prospectId"');
    expect(sql()).toContain('pj."projet" = "CHUES"');
  });

  it('un seul téléconseiller borne les lignes', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    await new SupervisionActivityService(service).activite({ commercialId: 'com-alice' });

    expect(sql()).toContain('u."id" = "com-alice"');
  });

  it('la campagne borne les tentatives des deux familles', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    await new SupervisionActivityService(service).activite({ campaignId: 'camp-1' });

    expect(sql()).toContain('ca."campaignId" = "camp-1"');
    expect(sql()).toContain('rca."campaignId" = "camp-1"');
  });
});
