import { describe, expect, it } from 'vitest';

import { BankCaseAnalyticsService } from './bank-cases-analytics.service.js';
import type { PrismaService } from '../../prisma/prisma.service.js';

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
    );

    const [banque] = await service.byBank({});

    expect(banque?.banqueId).toBe('bnq-cbao');
    expect(Object.keys(banque ?? {})).not.toContain('bankId');
  });
});
