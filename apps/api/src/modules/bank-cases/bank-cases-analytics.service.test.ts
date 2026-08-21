import { describe, expect, it, vi } from 'vitest';

import { BankCaseAnalyticsService } from './bank-cases-analytics.service.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';
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
      fakeDemoVisibility(),
    );

    const [banque] = await service.byBank({});

    expect(banque?.banqueId).toBe('bnq-cbao');
    expect(Object.keys(banque ?? {})).not.toContain('bankId');
  });
});

describe('overview', () => {
  it('fige le mode démonstration pour tous les agrégats de la réponse', async () => {
    const enabled = vi.fn().mockResolvedValueOnce(false).mockResolvedValue(true);
    const service = new BankCaseAnalyticsService(prismaReturning([]), {
      enabled,
    } as never);

    await service.overview({});

    expect(enabled).toHaveBeenCalledTimes(1);
  });
});
