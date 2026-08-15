import { Role } from '@crm/database';
import { describe, expect, it } from 'vitest';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';
import { makeAnalyticsPrisma } from './fake-analytics-prisma.js';
import { PortfolioService } from './portfolio.service.js';

const admin: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@cpi.sn',
  username: 'admin',
  fullName: 'Administrateur CPI',
  role: Role.ADMIN,
};

describe('vieillissement du portefeuille bancaire', () => {
  it('ne regarde que les dossiers vivants, et filtre la démonstration', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    await new PortfolioService(service, fakeDemoVisibility()).bankAging(admin, {});

    // Un dossier encaissé ou rejeté est sorti du portefeuille : le laisser
    // vieillir remplirait « plus de 60 jours » de dossiers clos.
    expect(sql()).toContain(`st."type" = 'OPEN'`);
    expect(sql()).toContain('bc."deletedAt" IS NULL');
    expect(sql()).toContain('bc."isDemo" = FALSE');
    expect(sql()).toContain('tr."isDemo" = FALSE');
  });

  it('base vide : les cinq tranches restent présentes, à zéro', async () => {
    const { service } = makeAnalyticsPrisma();
    const result = await new PortfolioService(service, fakeDemoVisibility()).bankAging(admin, {});

    expect(result.total).toBe(0);
    expect(result.stages).toEqual([]);
    expect(result.buckets.map((bucket) => bucket.bucket)).toEqual([
      'J0_7',
      'J8_15',
      'J16_30',
      'J31_60',
      'J60_PLUS',
    ]);
    // Les cinq barres restent présentes à zéro dossier, mais leur PART est
    // nulle : aucun dossier au dénominateur, donc aucune part à publier.
    expect(result.buckets.every((bucket) => bucket.dossiers === 0 && bucket.share === null)).toBe(
      true,
    );
  });

  it('additionne les tranches de toutes les étapes sans les recompter', async () => {
    const { service } = makeAnalyticsPrisma([
      {
        id: 'st-1',
        label: 'Déposé',
        dossiers: 6,
        b1: 3,
        b2: 2,
        b3: 1,
        b4: 0,
        b5: 0,
        mediane: 4.25,
      },
      {
        id: 'st-2',
        label: 'Pièces manquantes',
        dossiers: 4,
        b1: 0,
        b2: 0,
        b3: 1,
        b4: 1,
        b5: 2,
        mediane: 41.7,
      },
    ]);

    const result = await new PortfolioService(service, fakeDemoVisibility()).bankAging(admin, {});

    expect(result.total).toBe(10);
    expect(result.buckets.map((bucket) => bucket.dossiers)).toEqual([3, 2, 2, 1, 2]);
    expect(result.buckets[0]?.share).toBe(30);
    expect(result.stages[1]?.medianStationDays).toBe(41.7);
    // La tranche interne d'une étape est rapportée à CETTE étape, pas au total.
    expect(result.stages[1]?.buckets[4]?.share).toBe(50);
    expect(result.stages[0]?.share).toBe(60);
  });
});

describe('cohortes hebdomadaires', () => {
  it('suit la semaine de SAISIE TERRAIN, pas celle de l’arrivée en base', async () => {
    const { service, sql } = makeAnalyticsPrisma();
    await new PortfolioService(service, fakeDemoVisibility()).weeklyCohorts(admin, {});

    expect(sql()).toContain(`date_trunc('week', p."clientCreatedAt")`);
    expect(sql()).toContain('p."isDemo" = FALSE');
    expect(sql()).toContain('bc."isDemo" = FALSE');
  });

  it('rend le montant en chaîne et le taux rapporté aux entrées', async () => {
    const { service } = makeAnalyticsPrisma([
      {
        semaine: '2026-07-06',
        prospects: 80,
        methodes: 40,
        dossiers: 20,
        encaisses: 6,
        montant: '18000000',
      },
      {
        semaine: '2026-07-13',
        prospects: 0,
        methodes: 0,
        dossiers: 0,
        encaisses: 0,
        montant: null,
      },
    ]);

    const result = await new PortfolioService(service, fakeDemoVisibility()).weeklyCohorts(
      admin,
      {},
    );

    expect(result.items[0]?.week).toBe('2026-07-06');
    // XOF est un Decimal(18,0) : jamais un nombre JSON.
    expect(result.items[0]?.cashedAmountXof).toBe('18000000');
    expect(result.items[0]?.conversionRate).toBe(7.5);
    // Cohorte vide : taux NUL, parce qu'une semaine sans entrée n'a pas
    // converti 0 %, elle n'a rien eu à convertir. Le montant, lui, reste '0' :
    // zéro franc encaissé est un fait, pas une absence.
    expect(result.items[1]?.conversionRate).toBeNull();
    expect(result.items[1]?.cashedAmountXof).toBe('0');
    expect(result.total).toBe(80);
  });

  it('base vide : charge utile bien formée', async () => {
    const { service, calls } = makeAnalyticsPrisma();
    const result = await new PortfolioService(service, fakeDemoVisibility()).weeklyCohorts(
      admin,
      {},
    );

    expect(calls()).toBe(1);
    expect(result).toEqual({ items: [], total: 0 });
  });
});

describe('rendement par département', () => {
  it('rend un taux et pas seulement un volume', async () => {
    const { service } = makeAnalyticsPrisma([
      {
        id: 'd-1',
        label: 'Dakar',
        prospects: 2000,
        methodes: 500,
        dossiers: 100,
        encaisses: 20,
        montant: '60000000',
      },
      {
        id: 'd-2',
        label: 'Thiès',
        prospects: 300,
        methodes: 200,
        dossiers: 60,
        encaisses: 36,
        montant: '90000000',
      },
    ]);

    const result = await new PortfolioService(service, fakeDemoVisibility()).departementYield(
      admin,
      {},
    );

    expect(result.items[0]?.conversionRate).toBe(1);
    expect(result.items[0]?.methodRate).toBe(25);
    // Le petit département convertit douze fois mieux : c'est ce que le volume
    // seul cachait.
    expect(result.items[1]?.conversionRate).toBe(12);
    expect(result.items[1]?.cashedAmountXof).toBe('90000000');
    expect(result.total).toBe(2300);
  });

  it('base vide : aucune division par zéro', async () => {
    const { service } = makeAnalyticsPrisma();
    const result = await new PortfolioService(service, fakeDemoVisibility()).departementYield(
      admin,
      {},
    );
    expect(result).toEqual({ items: [], total: 0 });
  });
});
