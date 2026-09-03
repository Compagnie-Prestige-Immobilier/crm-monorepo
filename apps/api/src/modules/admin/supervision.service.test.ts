import { Logger } from '@nestjs/common';
import { Role } from '@crm/database';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { SupervisionService } from './supervision.service.js';

interface HeartbeatRow {
  userId: string;
  lastPullAt: Date | null;
  lastPushAt: Date | null;
  pendingOps: number | null;
  appVersion: string | null;
}

const prismaWith = (
  findMany: ReturnType<typeof vi.fn>,
  heartbeats: HeartbeatRow[] = [],
  queryRaw: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue([]),
  groupBy: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue([]),
): { service: SupervisionService; findMany: typeof findMany } => {
  const prisma = {
    user: { findMany },
    refreshToken: { groupBy },
    syncBatch: { groupBy },
    callAttempt: { groupBy },
    repCallAttempt: { groupBy },
    bankCaseTransition: { groupBy },
    agentHeartbeat: { findMany: vi.fn().mockResolvedValue(heartbeats) },
    agentActivityDay: { findMany: vi.fn().mockResolvedValue([]) },
    $queryRaw: queryRaw,
  };
  return {
    service: new SupervisionService(prisma as unknown as PrismaService),
    findMany,
  };
};

const teleconseiller = {
  id: 'usr-1',
  fullName: 'Awa Diop',
  username: 'awa',
  email: 'awa@cpi.sn',
  role: Role.COMMERCIAL,
  isActive: true,
  lastLoginAt: null,
};

const autreTeleconseiller = {
  ...teleconseiller,
  id: 'usr-2',
  fullName: 'Bineta Sy',
  username: 'bineta',
  email: 'bineta@cpi.sn',
};

describe('qui figure dans l’écran des comptes supervisés', () => {
  it('les EXÉCUTANTS, et eux seuls', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const { service } = prismaWith(findMany);

    await service.overview();

    const where = (findMany.mock.calls[0] as [{ where: { role: { in: Role[] } } }])[0].where;
    expect(where.role.in).toEqual([Role.COMMERCIAL, Role.BANQUE_FINANCE]);
  });

  /**
   * La présence se déduit des lots de synchronisation et des tentatives
   * d'appel. Un superviseur n'en produit aucun : sa ligne serait dormante en
   * permanence, et il fausserait les trois compteurs de présence.
   */
  it('PAS le superviseur, qui n’exécute rien et n’a donc aucun signal', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const { service } = prismaWith(findMany);

    await service.overview();

    const where = (findMany.mock.calls[0] as [{ where: { role: { in: Role[] } } }])[0].where;
    expect(where.role.in).not.toContain(Role.SUPERVISEUR);
    expect(where.role.in).not.toContain(Role.ADMIN);
  });
});

describe('ce que le battement de cœur rend visible', () => {
  it('un appareil qui n’a RIEN à remonter est vu quand même', async () => {
    const vuA = new Date(Date.now() - 40_000);
    const { service } = prismaWith(vi.fn().mockResolvedValue([teleconseiller]), [
      {
        userId: 'usr-1',
        lastPullAt: vuA,
        lastPushAt: null,
        pendingOps: 12,
        appVersion: '1.4.2',
      },
    ]);

    const [row] = (await service.overview()).teleconseillers;

    expect(row?.lastSeenAt).toBe(vuA.toISOString());
    expect(row?.lastPullAt).toBe(vuA.toISOString());
    // Aucun lot reçu : la colonne des remontées reste vide, et ne ment pas.
    expect(row?.lastSyncAt).toBeNull();
    expect(row?.pendingOps).toBe(12);
    expect(row?.appVersion).toBe('1.4.2');
  });

  it('un appareil qui ne déclare pas sa file laisse « inconnu », jamais zéro', async () => {
    const { service } = prismaWith(vi.fn().mockResolvedValue([teleconseiller]), [
      {
        userId: 'usr-1',
        lastPullAt: new Date(),
        lastPushAt: null,
        pendingOps: null,
        appVersion: null,
      },
    ]);

    const [row] = (await service.overview()).teleconseillers;

    expect(row?.pendingOps).toBeNull();
    expect(row?.appVersion).toBeNull();
  });

  it('un compte sans aucun battement reste lisible', async () => {
    const { service } = prismaWith(vi.fn().mockResolvedValue([teleconseiller]));

    const [row] = (await service.overview()).teleconseillers;

    expect(row?.lastPullAt).toBeNull();
    expect(row?.pendingOps).toBeNull();
    expect(row?.presence).toBe('AWAY');
  });
});

describe('le rendement du jour', () => {
  it('compte un appel représentant comme dernière saisie', async () => {
    const writtenAt = new Date('2026-09-03T08:12:00.000Z');
    const groupBy = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ performedById: 'usr-1', _max: { createdAt: writtenAt } }])
      .mockResolvedValueOnce([]);
    const { service } = prismaWith(
      vi.fn().mockResolvedValue([teleconseiller]),
      [],
      vi.fn().mockResolvedValue([]),
      groupBy,
    );

    const [row] = (await service.overview()).teleconseillers;

    expect(row?.lastWriteAt).toBe(writtenAt.toISOString());
  });

  it('rend cadence, retard de remontée et premier appel au compte qui a appelé', async () => {
    const firstCallAt = new Date('2026-09-03T08:12:00.000Z');
    const { service } = prismaWith(
      vi.fn().mockResolvedValue([teleconseiller, autreTeleconseiller]),
      [],
      vi.fn().mockResolvedValue([
        {
          userId: 'usr-1',
          calls: 14,
          firstCallAt,
          medianGapSeconds: 420,
          medianUploadLagSeconds: 7320,
        },
      ]),
    );

    const [awa, bineta] = (await service.overview()).teleconseillers;

    expect(awa?.callsToday).toBe(14);
    expect(awa?.medianGapSeconds).toBe(420);
    expect(awa?.medianUploadLagSeconds).toBe(7320);
    expect(awa?.firstCallAt).toBe(firstCallAt.toISOString());

    expect(bineta?.callsToday).toBe(0);
    expect(bineta?.medianGapSeconds).toBeNull();
    expect(bineta?.medianUploadLagSeconds).toBeNull();
    expect(bineta?.firstCallAt).toBeNull();
  });

  it('ne compte que la journée de Dakar en cours, de minuit à minuit', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-09-03T15:40:00.000Z'));
      const queryRaw = vi.fn().mockResolvedValue([]);
      const { service } = prismaWith(vi.fn().mockResolvedValue([teleconseiller]), [], queryRaw);

      await service.overview();

      const dayWindow = queryRaw.mock.calls[0]?.[1] as { values: Date[] };
      expect(dayWindow.values.map((value) => value.toISOString())).toEqual([
        '2026-09-03T00:00:00.000Z',
        '2026-09-04T00:00:00.000Z',
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('une requête de rendement en échec laisse la présence lisible', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { service } = prismaWith(
      vi.fn().mockResolvedValue([teleconseiller]),
      [
        {
          userId: 'usr-1',
          lastPullAt: new Date(),
          lastPushAt: null,
          pendingOps: 3,
          appVersion: null,
        },
      ],
      vi.fn().mockRejectedValue(new Error('interrompue')),
    );

    const [row] = (await service.overview()).teleconseillers;

    expect(row?.presence).toBe('RECENT');
    expect(row?.pendingOps).toBe(3);
    expect(row?.callsToday).toBe(0);
    expect(row?.medianGapSeconds).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
