import { Role } from '@crm/database';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';
import { makeAnalyticsPrisma } from './fake-analytics-prisma.js';
import { PilotageService } from './pilotage.service.js';

const admin: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@cpi.sn',
  username: 'admin',
  fullName: 'Administrateur CPI',
  role: Role.ADMIN,
};
const alice: AuthenticatedUser = {
  ...admin,
  id: 'com-alice',
  username: 'alice',
  role: Role.COMMERCIAL,
};

/** Ligne d'agrégat complète, pour n'écrire dans chaque test que ce qu'il exerce. */
const totals = (over: Record<string, number> = {}): Record<string, number> => ({
  taches: 0,
  contactees: 0,
  restantes: 0,
  closes7: 0,
  tentatives: 0,
  joignables: 0,
  methodes: 0,
  ...over,
});

describe('pilotage de campagne', () => {
  it('pose la visibilité de démonstration sur CHAQUE table jointe', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    await new PilotageService(service, fakeDemoVisibility()).campaignPilotage(admin, {});

    // Le prospect ne suffit pas : une tâche ou une tentative fictive accrochée
    // à un prospect réel fausserait le taux de contact.
    expect(sql()).toContain('p."isDemo" = FALSE');
    expect(sql()).toContain('ct."isDemo" = FALSE');
    expect(sql()).toContain('ca."isDemo" = FALSE');
    expect(sql()).toContain('cc."isDemo" = FALSE');
  });

  it('mode démonstration allumé : aucune table n’est filtrée', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    await new PilotageService(service, fakeDemoVisibility(true)).campaignPilotage(admin, {});
    expect(sql()).not.toContain('isDemo');
  });

  it('sans campagne précisée, porte sur les campagnes ACTIVES', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    const result = await new PilotageService(service, fakeDemoVisibility()).campaignPilotage(
      admin,
      {},
    );

    expect(sql()).toContain(`cc."status" = 'ACTIVE'`);
    expect(result.campaignId).toBeNull();
  });

  it('borne la mesure à la campagne demandée', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    const result = await new PilotageService(service, fakeDemoVisibility()).campaignPilotage(
      admin,
      { campaignId: 'camp-1' },
    );

    expect(sql()).toContain('cc."id" = "camp-1"');
    expect(result.campaignId).toBe('camp-1');
  });

  it('un COMMERCIAL reste borné à ses lignes', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    await new PilotageService(service, fakeDemoVisibility()).campaignPilotage(alice, {});
    expect(sql()).toContain('p."createdById" = "com-alice"');
  });

  // Un taux sur zéro observation n'est pas « 0 % », il n'existe pas. Le rendre
  // à 0 le rendait indistinguable d'une vraie contre-performance.
  it('base vide : charge utile complète, aucun taux inventé', async () => {
    const { service, calls } = makeAnalyticsPrisma();
    const result = await new PilotageService(service, fakeDemoVisibility()).campaignPilotage(
      admin,
      {},
    );

    expect(calls()).toBe(2);
    expect(result.tasks).toBe(0);
    expect(result.contactRate).toBeNull();
    expect(result.reachRate).toBeNull();
    expect(result.attemptsPerMethodObtained).toBe(0);
    expect(result.closedPerDay).toEqual([]);
    expect(result.observedPace).toBe(0);
    // Cadence nulle : pas de date de fin plutôt qu'une date lointaine qui
    // laisserait croire que la campagne avance.
    expect(result.estimatedEndDate).toBeNull();
  });

  it('aucune méthode obtenue : le rapport vaut 0, jamais l’infini', async () => {
    const { service } = makeAnalyticsPrisma([totals({ tentatives: 12, methodes: 0 })], []);
    const result = await new PilotageService(service, fakeDemoVisibility()).campaignPilotage(
      admin,
      {},
    );
    expect(result.attemptsPerMethodObtained).toBe(0);
  });

  it('calcule taux, cadence et date de fin projetée', async () => {
    const { service } = makeAnalyticsPrisma(
      [
        totals({
          taches: 200,
          contactees: 150,
          restantes: 50,
          closes7: 70,
          tentatives: 300,
          joignables: 240,
          methodes: 60,
        }),
      ],
      [{ jour: '2026-08-10', id: 'com-alice', nom: 'Alice Diop', done: 12 }],
    );

    const result = await new PilotageService(service, fakeDemoVisibility()).campaignPilotage(
      admin,
      {},
    );

    expect(result.contactRate).toBe(75);
    expect(result.reachRate).toBe(80);
    expect(result.attemptsPerMethodObtained).toBe(5);
    expect(result.observedPace).toBe(10);
    expect(result.closedPerDay).toEqual([
      { day: '2026-08-10', commercialId: 'com-alice', commercialName: 'Alice Diop', done: 12 },
    ]);
    // 50 restantes à 10 par jour : cinq jours.
    const attendu = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
    expect(result.estimatedEndDate).toBe(attendu);
  });
});

describe('délais de la chaîne', () => {
  it('rend les trois tronçons, dans l’ordre où ils se franchissent', async () => {
    const { service } = makeAnalyticsPrisma([
      { m1: 2.34, p1: 9.87, n1: 40, m2: 5, p2: 12, n2: 10, m3: 30.05, p3: 61, n3: 3 },
    ]);

    const result = await new PilotageService(service, fakeDemoVisibility()).delays(admin, {});

    expect(result.legs.map((leg) => leg.leg)).toEqual([
      'CREATION_TO_METHOD',
      'METHOD_TO_CASE',
      'CASE_TO_CASHED',
    ]);
    expect(result.legs[0]?.medianDays).toBe(2.3);
    expect(result.legs[0]?.p90Days).toBe(9.9);
    expect(result.legs[0]?.sample).toBe(40);
    expect(result.legs[2]?.medianDays).toBe(30.1);
  });

  it('un tronçon sans échantillon rend NULL, jamais 0', async () => {
    const { service } = makeAnalyticsPrisma([
      { m1: null, p1: null, n1: 0, m2: null, p2: null, n2: 0, m3: null, p3: null, n3: 0 },
    ]);

    const result = await new PilotageService(service, fakeDemoVisibility()).delays(admin, {});

    for (const leg of result.legs) {
      // 0 se lirait « franchi le jour même », ce qui n'est pas « aucune mesure ».
      expect(leg.medianDays).toBeNull();
      expect(leg.p90Days).toBeNull();
      expect(leg.sample).toBe(0);
    }
  });

  it('base vide : la charge utile garde ses trois tronçons', async () => {
    const { service, calls } = makeAnalyticsPrisma();
    const result = await new PilotageService(service, fakeDemoVisibility()).delays(admin, {});

    expect(calls()).toBe(1);
    expect(result.legs).toHaveLength(3);
    expect(result.legs.every((leg) => leg.medianDays === null && leg.sample === 0)).toBe(true);
  });

  it('n’agrège que des durées positives, et filtre la démonstration', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    await new PilotageService(service, fakeDemoVisibility()).delays(admin, {});

    expect(sql()).toContain('percentile_cont(0.5)');
    expect(sql()).toContain('percentile_cont(0.9)');
    // L'horloge du téléphone peut avancer sur celle du serveur : une durée
    // négative n'est pas un délai court, c'est une mesure à jeter.
    expect(sql()).toContain('>=');
    expect(sql()).toContain('bc."isDemo" = FALSE');
    expect(sql()).toContain('tr."isDemo" = FALSE');
  });
});
