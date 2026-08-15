import { describe, expect, it } from 'vitest';

import { BankCaseAnalyticsService } from './bank-cases-analytics.service.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

/**
 * La répartition par banque nomme sa clé étrangère comme le reste du contrat.
 *
 * Le module publiait `bankId` en réponse alors que le même identifiant s'appelle
 * `banqueId` partout ailleurs : un client qui recoupe le tableau de bord avec la
 * liste doit pouvoir joindre les deux sur la MÊME clé, sans table de
 * correspondance écrite à la main.
 */

/** Prisma réduit à ce que `byBank` en attend : une lecture agrégée. */
const prismaReturning = (rows: unknown[]): PrismaService =>
  ({ $queryRaw: () => Promise.resolve(rows) }) as unknown as PrismaService;

describe('byBank', () => {
  it('publie l’identifiant de banque sous le nom « banqueId »', async () => {
    const service = new BankCaseAnalyticsService(
      prismaReturning([
        {
          banqueId: 'bnq-cbao',
          label: 'CBAO',
          cases: 2,
          cashed: 1,
          rejected: 0,
          amount: '1200000',
          meanSeconds: 45000,
        },
      ]),
      fakeDemoVisibility(),
    );

    const [banque] = await service.byBank({});

    expect(banque?.banqueId).toBe('bnq-cbao');
    // Le nom abandonné ne doit pas survivre en double dans la réponse.
    expect(Object.keys(banque ?? {})).not.toContain('bankId');
  });
});
