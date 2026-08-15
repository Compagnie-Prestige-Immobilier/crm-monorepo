import { Role } from '@crm/database';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';
import { makeAnalyticsPrisma } from './fake-analytics-prisma.js';
import { QualityService } from './quality.service.js';

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

describe('productivité des représentants', () => {
  it('calcule la dormance en base, sur le seuil par défaut de 90 jours', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    const result = await new QualityService(service, fakeDemoVisibility()).representantProductivity(
      admin,
      {},
    );

    expect(sql()).toContain('90::int');
    expect(sql()).toContain('p."isDemo" = FALSE');
    expect(result.dormantDays).toBe(90);
  });

  it('accepte un seuil de dormance propre à la zone', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    const result = await new QualityService(service, fakeDemoVisibility()).representantProductivity(
      admin,
      { dormantDays: 30 },
    );

    expect(sql()).toContain('30::int');
    expect(result.dormantDays).toBe(30);
  });

  it('rend le taux de conversion, le dernier apport et le drapeau dormant', async () => {
    const { service } = makeAnalyticsPrisma([
      {
        id: 'r-1',
        label: 'Modou Fall',
        departement: 'Thiès',
        prospects: 40,
        methodes: 30,
        dernier: new Date('2026-08-01T10:00:00.000Z'),
        dormant: false,
        population: 52,
      },
      {
        id: 'r-2',
        label: 'Awa Sow',
        departement: 'Dakar',
        prospects: 12,
        methodes: 0,
        dernier: null,
        dormant: true,
        population: 52,
      },
    ]);

    const result = await new QualityService(service, fakeDemoVisibility()).representantProductivity(
      admin,
      {},
    );

    expect(result.items[0]?.conversionRate).toBe(75);
    expect(result.items[0]?.lastProspectAt).toBe('2026-08-01T10:00:00.000Z');
    expect(result.items[0]?.dormant).toBe(false);
    // Aucun apport : 0 plutôt qu'une division par zéro.
    expect(result.items[1]?.conversionRate).toBe(0);
    expect(result.items[1]?.lastProspectAt).toBeNull();
    expect(result.total).toBe(52);
  });

  // Régression : `total` sommait les lignes RENDUES, donc les dix premières.
  // Avec 400 représentants il annonçait les prospects du haut de classement
  // sous un nom qui se lit « total ». Le total vient désormais d'une fonction
  // de fenêtre, évaluée avant le LIMIT, donc sur toute la population.
  it('rend le total de la population, pas celui du haut de classement', async () => {
    const { service, sql } = makeAnalyticsPrisma([
      {
        id: 'r-1',
        label: 'Modou Fall',
        departement: 'Thiès',
        prospects: 40,
        methodes: 30,
        dernier: null,
        dormant: false,
        population: 9_000,
      },
    ]);

    const result = await new QualityService(service, fakeDemoVisibility()).representantProductivity(
      admin,
      { limit: 1 },
    );

    expect(sql()).toContain('SUM(COUNT(*)) OVER ()');
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(9_000);
  });

  it('un COMMERCIAL ne lit que ses propres apporteurs', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    await new QualityService(service, fakeDemoVisibility()).representantProductivity(alice, {});
    expect(sql()).toContain('p."createdById" = "com-alice"');
  });
});

describe('qualité de la base', () => {
  it('compte les MÊMES tentatives selon deux axes', async () => {
    const { service, queries } = makeAnalyticsPrisma(
      [{ id: 'r-1', label: 'Modou Fall', tentatives: 10, injoignables: 3, errones: 2 }],
      [{ id: 'd-1', label: 'Thiès', tentatives: 10, injoignables: 3, errones: 2 }],
    );

    const result = await new QualityService(service, fakeDemoVisibility()).dataQuality(admin, {});

    expect(queries()).toHaveLength(2);
    // Deux axes, une seule population : les totaux doivent coïncider.
    expect(result.representants[0]?.badRate).toBe(50);
    expect(result.departements[0]?.badRate).toBe(50);
    expect(result.attempts).toBe(10);
    expect(result.badRate).toBe(50);
    // Le second axe passe par le département du représentant.
    expect(queries()[1]).toContain('"departements"');
  });

  it('se branche sur les issues d’appel, avec la visibilité de démonstration', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    await new QualityService(service, fakeDemoVisibility()).dataQuality(admin, {});

    expect(sql()).toContain(`ca."outcome" = 'UNREACHABLE'`);
    expect(sql()).toContain(`ca."outcome" = 'WRONG_NUMBER'`);
    expect(sql()).toContain('ca."isDemo" = FALSE');
  });

  it('aucune tentative : taux NULS, jamais une division par zéro ni un faux 0 %', async () => {
    const { service } = makeAnalyticsPrisma(
      [{ id: 'r-1', label: 'Modou Fall', tentatives: 0, injoignables: 0, errones: 0 }],
      [],
    );

    const result = await new QualityService(service, fakeDemoVisibility()).dataQuality(admin, {});

    expect(result.representants[0]?.badRate).toBeNull();
    expect(result.departements).toEqual([]);
    expect(result.badRate).toBeNull();
  });
});

describe('provenance des fiches', () => {
  it('une provenance absente est la saisie terrain, pas une provenance inconnue', async () => {
    const { service } = makeAnalyticsPrisma(
      [
        { origin: null, prospects: 900 },
        { origin: 'BANQUE', prospects: 100 },
      ],
      [
        { origin: null, detail: null, prospects: 900 },
        { origin: 'BANQUE', detail: 'CBAO Thiès', prospects: 100 },
      ],
    );

    const result = await new QualityService(service, fakeDemoVisibility()).originBreakdown(
      admin,
      {},
    );

    expect(result.items[0]).toEqual({
      origin: null,
      label: 'Saisie terrain',
      prospects: 900,
      share: 90,
    });
    expect(result.items[1]?.label).toBe('Banque');
    expect(result.byLabel[1]?.originLabel).toBe('CBAO Thiès');
    expect(result.byLabel[1]?.label).toBe('CBAO Thiès');
    // Le second niveau se rapporte au MÊME total que le premier.
    expect(result.byLabel[0]?.share).toBe(90);
    expect(result.total).toBe(1000);
  });

  it('une provenance encore inconnue du libellé sort telle quelle', async () => {
    const { service } = makeAnalyticsPrisma([{ origin: 'PARTENAIRE', prospects: 5 }], []);
    const result = await new QualityService(service, fakeDemoVisibility()).originBreakdown(
      admin,
      {},
    );
    // Remplacer par « Inconnu » masquerait l'apparition d'un nouveau canal.
    expect(result.items[0]?.label).toBe('PARTENAIRE');
  });

  it('base vide : charge utile bien formée', async () => {
    const { service, calls } = makeAnalyticsPrisma();
    const result = await new QualityService(service, fakeDemoVisibility()).originBreakdown(
      admin,
      {},
    );

    expect(calls()).toBe(2);
    expect(result).toEqual({ items: [], byLabel: [], total: 0 });
  });
});
