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
): { service: SupervisionService; findMany: typeof findMany } => {
  const groupBy = vi.fn().mockResolvedValue([]);
  const prisma = {
    user: { findMany },
    refreshToken: { groupBy },
    syncBatch: { groupBy },
    callAttempt: { groupBy },
    bankCaseTransition: { groupBy },
    agentHeartbeat: { findMany: vi.fn().mockResolvedValue(heartbeats) },
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

describe('qui figure dans l’écran des comptes supervisés', () => {
  it('les EXÉCUTANTS, et eux seuls', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const { service } = prismaWith(findMany);

    await service.overview();

    const where = (findMany.mock.calls[0]?.[0] as { where: { role: { in: Role[] } } }).where;
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

    const where = (findMany.mock.calls[0]?.[0] as { where: { role: { in: Role[] } } }).where;
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
