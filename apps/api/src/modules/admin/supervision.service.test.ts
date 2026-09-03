import { Logger } from '@nestjs/common';
import { Role } from '@crm/database';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { WorkShiftsService } from '../analytics/work-shifts.service.js';
import { SupervisionService } from './supervision.service.js';

interface HeartbeatRow {
  userId: string;
  lastPullAt: Date | null;
  lastPushAt: Date | null;
  pendingOps: number | null;
  appVersion: string | null;
}

interface SlotRow {
  userId: string;
  slot: Date;
  firstSeenAt: Date;
  lastSeenAt: Date;
  activeSeconds: number;
}

const prismaWith = (
  findMany: ReturnType<typeof vi.fn>,
  heartbeats: HeartbeatRow[] = [],
  queryRaw: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue([]),
  groupBy: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue([]),
  slots: SlotRow[] = [],
): { service: SupervisionService; findMany: typeof findMany } => {
  const prisma = {
    user: { findMany },
    refreshToken: { groupBy },
    syncBatch: { groupBy },
    callAttempt: { groupBy },
    repCallAttempt: { groupBy },
    bankCaseTransition: { groupBy },
    agentHeartbeat: { findMany: vi.fn().mockResolvedValue(heartbeats) },
    agentActivitySlot: { findMany: vi.fn().mockResolvedValue(slots) },
    appSetting: { findUnique: vi.fn().mockResolvedValue(null) },
    $queryRaw: queryRaw,
  };
  const service = new SupervisionService(
    prisma as unknown as PrismaService,
    new WorkShiftsService(prisma as unknown as PrismaService),
  );
  return { service, findMany };
};

/** Créneaux par défaut, ceux que `WorkShiftsService` rend sans réglage en base. */
const slotAt = (hour: number, activeSeconds: number): SlotRow => {
  const slot = new Date(Date.UTC(2026, 8, 3, hour));
  return { userId: 'usr-1', slot, firstSeenAt: slot, lastSeenAt: slot, activeSeconds };
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

      const dates = (queryRaw.mock.calls[0] as unknown[])
        .flatMap((value) => {
          const fragment = (value as { values?: unknown }).values;
          return Array.isArray(fragment) ? (fragment as unknown[]) : [value];
        })
        .filter((value): value is Date => value instanceof Date);

      expect([...new Set(dates.map((date) => date.toISOString()))]).toEqual([
        '2026-09-03T00:00:00.000Z',
        '2026-09-04T00:00:00.000Z',
      ]);
    } finally {
      vi.useRealTimers();
    }
  });

  it('rend le dernier appel, les joints, les qualifiés, les reprises et le temps mort', async () => {
    const firstCallAt = new Date('2026-09-03T08:12:00.000Z');
    const lastCallAt = new Date('2026-09-03T17:40:00.000Z');
    const { service } = prismaWith(
      vi.fn().mockResolvedValue([teleconseiller, autreTeleconseiller]),
      [],
      vi.fn().mockResolvedValue([
        {
          userId: 'usr-1',
          calls: 14,
          firstCallAt,
          lastCallAt,
          reachedToday: 9,
          qualifiedToday: 4,
          repeatCalls: 3,
          deadSeconds: 2400,
          deadGaps: 2,
          medianGapSeconds: 420,
          medianUploadLagSeconds: 7320,
        },
      ]),
    );

    const [awa, bineta] = (await service.overview()).teleconseillers;

    expect(awa?.lastCallAt).toBe(lastCallAt.toISOString());
    expect(awa?.reachedToday).toBe(9);
    expect(awa?.qualifiedToday).toBe(4);
    expect(awa?.repeatCalls).toBe(3);
    expect(awa?.deadSeconds).toBe(2400);
    expect(awa?.deadGaps).toBe(2);

    // Aucune tentative : des zéros et des null, jamais NaN.
    expect(bineta?.lastCallAt).toBeNull();
    expect(bineta?.reachedToday).toBe(0);
    expect(bineta?.qualifiedToday).toBe(0);
    expect(bineta?.repeatCalls).toBe(0);
    expect(bineta?.deadSeconds).toBe(0);
    expect(bineta?.deadGaps).toBe(0);
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

describe('la présence découpée à l’heure', () => {
  it('somme les tranches du jour, et ne retient dans les créneaux que celles qui y tombent', async () => {
    const { service } = prismaWith(
      vi.fn().mockResolvedValue([teleconseiller]),
      [],
      vi.fn().mockResolvedValue([]),
      vi.fn().mockResolvedValue([]),
      // 8 h précède le créneau du matin, 14 h tombe dans la pause.
      [slotAt(8, 600), slotAt(9, 3000), slotAt(14, 1200), slotAt(15, 900)],
    );

    const [row] = (await service.overview()).teleconseillers;

    expect(row?.activeSecondsToday).toBe(5700);
    expect(row?.activeSecondsInShifts).toBe(3900);
    expect(row?.firstSeenToday).toBe(new Date(Date.UTC(2026, 8, 3, 8)).toISOString());
  });

  it('un compte sans aucune tranche rend zéro, jamais NaN', async () => {
    const { service } = prismaWith(vi.fn().mockResolvedValue([teleconseiller]));

    const [row] = (await service.overview()).teleconseillers;

    expect(row?.activeSecondsToday).toBe(0);
    expect(row?.activeSecondsInShifts).toBe(0);
    expect(row?.firstSeenToday).toBeNull();
  });
});

describe('le temps de créneau déjà écoulé', () => {
  const aLHeureDite = async (iso: string): Promise<number> => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(iso));
      const { service } = prismaWith(vi.fn().mockResolvedValue([]));
      return (await service.overview()).shiftSecondsElapsed;
    } finally {
      vi.useRealTimers();
    }
  };

  it('vaut zéro avant l’ouverture', async () => {
    expect(await aLHeureDite('2026-09-03T07:30:00.000Z')).toBe(0);
  });

  it('compte l’heure entamée du matin', async () => {
    expect(await aLHeureDite('2026-09-03T10:00:00.000Z')).toBe(3600);
  });

  it('n’avance plus pendant la pause', async () => {
    expect(await aLHeureDite('2026-09-03T14:30:00.000Z')).toBe(18000);
  });

  it('plafonne à la durée des deux créneaux après la fermeture', async () => {
    expect(await aLHeureDite('2026-09-03T21:00:00.000Z')).toBe(28800);
  });

  it('rend les créneaux qui ont servi au calcul', async () => {
    const { service } = prismaWith(vi.fn().mockResolvedValue([]));

    const { shifts } = await service.overview();

    expect(shifts.map((shift) => [shift.key, shift.start, shift.end])).toEqual([
      ['morning', '09:00', '14:00'],
      ['afternoon', '15:00', '18:00'],
    ]);
  });
});
