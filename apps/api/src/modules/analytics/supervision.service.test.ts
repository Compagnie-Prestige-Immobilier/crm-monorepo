import { describe, expect, it } from 'vitest';

import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';
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

describe('activité des téléconseillers', () => {
  it('mesure la date de l’ACTE, jamais l’arrivée en base', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    await new SupervisionActivityService(service, fakeDemoVisibility()).activite({});

    expect(sql()).toContain('ca."clientCreatedAt"');
    expect(sql()).toContain('p."clientCreatedAt"');
    expect(sql()).toContain('rca."clientCreatedAt"');
    expect(sql()).toContain('ct."completedAt"');
    expect(sql()).not.toContain('ca."createdAt"');
  });

  it('borne la fenêtre sur la journée de Dakar, bornes incluses', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    await new SupervisionActivityService(service, fakeDemoVisibility()).activite({
      actFrom: '2026-08-17',
      actTo: '2026-08-17',
    });

    expect(sql()).toContain('"2026-08-17T00:00:00.000Z"');
    expect(sql()).toContain('"2026-08-17T23:59:59.999Z"');
  });

  it('sans fenêtre, aucune borne de date n’est posée', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    const result = await new SupervisionActivityService(service, fakeDemoVisibility()).activite({});

    expect(sql()).not.toContain('>=');
    expect(result.from).toBeNull();
    expect(result.to).toBeNull();
  });

  it('n’injecte jamais la granularité reçue dans le date_trunc', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    await new SupervisionActivityService(service, fakeDemoVisibility()).activite({
      granularity: SupervisionGranularity.WEEK,
    });

    expect(sql()).toContain("date_trunc('week'");
    expect(sql()).not.toContain('date_trunc("week"');
  });

  it('pose la visibilité de démonstration sur CHAQUE table lue', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    await new SupervisionActivityService(service, fakeDemoVisibility()).activite({});

    for (const alias of ['ca', 'p', 'rca', 'ct', 'u']) {
      expect(sql()).toContain(`${alias}."isDemo" = FALSE`);
    }
  });

  it('mode démonstration allumé : aucune table n’est filtrée', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    await new SupervisionActivityService(service, fakeDemoVisibility(true)).activite({});
    expect(sql()).not.toContain('isDemo');
  });

  it('ne compte que les téléconseillers', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    await new SupervisionActivityService(service, fakeDemoVisibility()).activite({});

    expect(sql()).toContain('u."role" = "COMMERCIAL"');
    expect(sql()).toContain('u."deletedAt" IS NULL');
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
      [{ id: 'com-alice', nom: 'Alice Diop', actif: true, ouvertes: 12 }],
    );

    const result = await new SupervisionActivityService(service, fakeDemoVisibility()).activite({});
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
    });
    expect(result.teleconseillers).toEqual([
      { id: 'com-alice', fullName: 'Alice Diop', isActive: true, openTasks: 12 },
    ]);
  });

  it('aucun appel : le taux vaut null, jamais 0', async () => {
    const { service } = makeAnalyticsPrisma([ligne({ prospects: 3 })], []);
    const result = await new SupervisionActivityService(service, fakeDemoVisibility()).activite({});

    expect(result.items[0]?.calls).toBe(0);
    expect(result.items[0]?.reachRate).toBeNull();
  });

  it('base vide : charge utile complète, deux requêtes', async () => {
    const { service, calls } = makeAnalyticsPrisma();
    const result = await new SupervisionActivityService(service, fakeDemoVisibility()).activite({});

    expect(calls()).toBe(2);
    expect(result.items).toEqual([]);
    expect(result.teleconseillers).toEqual([]);
    expect(result.granularity).toBe(SupervisionGranularity.DAY);
  });
});
