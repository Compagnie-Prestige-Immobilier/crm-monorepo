import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import {
  CallOutcome,
  CallTaskStatus,
  CampaignScope,
  CampaignStatus,
  EnrollmentMethod,
  Role,
  ScheduledCallbackStatus,
} from '@crm/database';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { shortCode } from '../../common/short-code.js';
import { Phase2CampaignsService, scopeLabel } from './campaigns.service.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';

type MockFn = ReturnType<typeof vi.fn>;

type MockDb = {
  callCampaign: Record<'count' | 'findMany' | 'findFirst' | 'create' | 'update', MockFn>;
  callCampaignCommercial: Record<'findUnique' | 'createMany', MockFn>;
  callTask: Record<'groupBy' | 'findMany' | 'count' | 'updateMany' | 'createMany', MockFn>;
  callAttempt: Record<'findMany', MockFn>;
  scheduledCallback: Record<'updateMany', MockFn>;
  prospect: Record<'findMany', MockFn>;
  user: Record<'findMany', MockFn>;
  $transaction: MockFn;
  $executeRawUnsafe: MockFn;
  $queryRawUnsafe: MockFn;
};

const ADMIN: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@cpi.sn',
  username: 'admin',
  fullName: 'Admin CPI',
  role: Role.ADMIN,
};
const TELECONSEILLER: AuthenticatedUser = {
  id: 'com-1',
  email: 'awa@cpi.sn',
  username: 'awa',
  fullName: 'Awa Ndiaye',
  role: Role.COMMERCIAL,
};
const date = new Date('2026-04-08T14:30:00.000Z');

function prismaStub(): MockDb {
  const db: MockDb = {
    callCampaign: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    callCampaignCommercial: { findUnique: vi.fn(), createMany: vi.fn() },
    callTask: {
      groupBy: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn().mockResolvedValue(100),
      updateMany: vi.fn(),
      createMany: vi.fn(),
    },
    callAttempt: { findMany: vi.fn() },
    scheduledCallback: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    prospect: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    $transaction: vi.fn(),
    $executeRawUnsafe: vi.fn(),
    $queryRawUnsafe: vi.fn(),
  };
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  db.$transaction.mockImplementation((run: (tx: MockDb) => Promise<unknown>) => run(db));
  return db;
}

describe('scopeLabel', () => {
  it('garde un libellé distinct pour ALL et les quatre segments', () => {
    expect(scopeLabel(CampaignScope.ALL)).toContain('BDD1');
    expect(new Set(Object.values(CampaignScope).map(scopeLabel)).size).toBe(5);
  });
});

describe('Phase2CampaignsService, parcours de campagne', () => {
  it('liste les campagnes et reconstruit la progression depuis les tâches', async () => {
    const db = prismaStub();
    db.callCampaign.count.mockResolvedValue(1);
    db.callCampaign.findMany.mockResolvedValue([
      {
        id: 'camp-1',
        name: 'Avril',
        scope: CampaignScope.BDD1,
        status: CampaignStatus.ACTIVE,
        seed: 'seed',
        spreadDays: 1,
        createdById: ADMIN.id,
        createdAt: date,
        closedAt: null,
        createdBy: { fullName: ADMIN.fullName },
        _count: { commerciaux: 2 },
      },
    ]);
    db.callTask.groupBy.mockResolvedValue([
      { campaignId: 'camp-1', status: CallTaskStatus.OPEN, _count: { _all: 3 } },
      { campaignId: 'camp-1', status: CallTaskStatus.DONE, _count: { _all: 2 } },
      { campaignId: 'camp-1', status: CallTaskStatus.CANCELLED, _count: { _all: 1 } },
    ]);

    const result = await new Phase2CampaignsService(
      db as unknown as PrismaService,
      fakeDemoVisibility(),
    ).list(ADMIN, {});

    expect(result.items[0]?.progress).toEqual({ total: 6, open: 3, done: 2, cancelled: 1 });
    expect(result.items[0]?.scopeLabel).toContain('CHUES');
    expect(result.meta).toEqual({ total: 1, page: 1, pageSize: 25, pageCount: 1 });

    const where = (db.callCampaign.findMany.mock.calls[0]?.[0] as { where: object }).where;
    expect(where).not.toHaveProperty('tasks');
    expect((db.callTask.groupBy.mock.calls[0]?.[0] as { where: object }).where).not.toHaveProperty(
      'assignedToId',
    );
  });

  it('une liste vide reste UNE page vide, comme partout ailleurs', async () => {
    const db = prismaStub();
    db.callCampaign.findMany.mockResolvedValue([]);
    db.callCampaign.count.mockResolvedValue(0);
    db.callTask.groupBy.mockResolvedValue([]);

    const result = await new Phase2CampaignsService(
      db as unknown as PrismaService,
      fakeDemoVisibility(),
    ).list(ADMIN, {});

    expect(result.items).toEqual([]);
    expect(result.meta).toEqual({ total: 0, page: 1, pageSize: 25, pageCount: 1 });
  });

  it('CLOISONNE la liste d’un téléconseiller sur les campagnes où il a des tâches', async () => {
    const db = prismaStub();
    db.callCampaign.count.mockResolvedValue(0);
    db.callCampaign.findMany.mockResolvedValue([]);
    db.callTask.groupBy.mockResolvedValue([]);

    await new Phase2CampaignsService(db as unknown as PrismaService, fakeDemoVisibility()).list(
      TELECONSEILLER,
      {},
    );

    for (const call of [db.callCampaign.count, db.callCampaign.findMany]) {
      const where = (call.mock.calls[0]?.[0] as { where: Record<string, unknown> }).where;
      expect(where).toMatchObject({ tasks: { some: { assignedToId: TELECONSEILLER.id } } });
    }
  });

  it('ne rend à un téléconseiller que SES compteurs, pas ceux de l’équipe', async () => {
    const db = prismaStub();
    db.callCampaign.count.mockResolvedValue(1);
    db.callCampaign.findMany.mockResolvedValue([
      {
        id: 'camp-1',
        name: 'Avril',
        scope: CampaignScope.BDD1,
        status: CampaignStatus.ACTIVE,
        seed: 'seed',
        spreadDays: 1,
        createdById: ADMIN.id,
        createdAt: date,
        closedAt: null,
        createdBy: { fullName: ADMIN.fullName },
        _count: { commerciaux: 2 },
      },
    ]);
    db.callTask.groupBy.mockResolvedValue([
      { campaignId: 'camp-1', status: CallTaskStatus.OPEN, _count: { _all: 2 } },
    ]);

    const result = await new Phase2CampaignsService(
      db as unknown as PrismaService,
      fakeDemoVisibility(),
    ).list(TELECONSEILLER, {});

    // Le décompte est BORNÉ EN BASE : sans cette clause, la campagne rendrait les
    // tâches de toute l'équipe sous couvert d'un « avancement ».
    const where = (db.callTask.groupBy.mock.calls[0]?.[0] as { where: object }).where;
    expect(where).toMatchObject({ assignedToId: TELECONSEILLER.id });
    expect(result.items[0]?.progress).toEqual({ total: 2, open: 2, done: 0, cancelled: 0 });
  });

  it('rend le détail avec progression par commercial et tentative récente', async () => {
    const db = prismaStub();
    db.callCampaign.findFirst.mockResolvedValue({
      id: 'camp-1',
      name: 'Avril',
      scope: CampaignScope.ALL,
      status: CampaignStatus.ACTIVE,
      seed: 'seed',
      spreadDays: 1,
      createdById: ADMIN.id,
      createdAt: date,
      closedAt: null,
      createdBy: { fullName: ADMIN.fullName },
      commerciaux: [{ position: 1, user: { id: 'com-1', fullName: 'Awa', username: 'awa' } }],
    });
    db.callTask.groupBy.mockResolvedValue([
      { assignedToId: 'com-1', status: CallTaskStatus.DONE, _count: { _all: 1 } },
    ]);
    db.callAttempt.findMany.mockResolvedValue([
      {
        id: 'attempt-1',
        outcome: CallOutcome.METHOD_OBTAINED,
        method: EnrollmentMethod.PLATFORM,
        comment: null,
        performedById: 'com-1',
        createdAt: date,
        prospect: { id: 'prospect-1', phoneE164: '+221771234567' },
        performedBy: { fullName: 'Awa' },
        task: { assignedToId: 'com-1' },
      },
    ]);

    const result = await new Phase2CampaignsService(
      db as unknown as PrismaService,
      fakeDemoVisibility(),
    ).get('camp-1');

    expect(result.progress).toEqual({ total: 1, open: 0, done: 1, cancelled: 0 });
    expect(result.commerciaux[0]?.progress.done).toBe(1);
    expect(result.recentAttempts[0]).toMatchObject({
      shortCode: shortCode('prospect-1'),
      phoneE164: '+221771234567',
      method: EnrollmentMethod.PLATFORM,
      assignedToId: 'com-1',
    });
  });

  it('refuse un détail inexistant avec un code métier stable', async () => {
    const db = prismaStub();
    db.callCampaign.findFirst.mockResolvedValue(null);
    await expect(
      new Phase2CampaignsService(db as unknown as PrismaService, fakeDemoVisibility()).get(
        'missing',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('CLOISONNE le détail : mode éteint, l’identifiant ne suffit pas', async () => {
    const db = prismaStub();
    db.callCampaign.findFirst.mockResolvedValue(null);

    await expect(
      new Phase2CampaignsService(db as unknown as PrismaService, fakeDemoVisibility(false)).get(
        'camp-demo',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    const where = (
      db.callCampaign.findFirst.mock.calls[0] as [{ where: Record<string, unknown> }]
    )[0].where;
    expect(where).toMatchObject({ id: 'camp-demo', isDemo: false });
  });

  it('CLOISONNE la clôture, qui est une ÉCRITURE décidée par cette lecture', async () => {
    const db = prismaStub();
    db.callCampaign.findFirst.mockResolvedValue(null);

    await expect(
      new Phase2CampaignsService(db as unknown as PrismaService, fakeDemoVisibility(false)).close(
        'camp-demo',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    const where = (
      db.callCampaign.findFirst.mock.calls[0] as [{ where: Record<string, unknown> }]
    )[0].where;
    expect(where).toMatchObject({ id: 'camp-demo', isDemo: false });
    expect(db.callTask.updateMany).not.toHaveBeenCalled();
  });

  it('annule les tâches ouvertes à la clôture', async () => {
    const db = prismaStub();
    db.callCampaign.findFirst.mockResolvedValueOnce({ status: CampaignStatus.ACTIVE });
    db.callCampaign.update.mockResolvedValue({});
    db.callTask.updateMany.mockResolvedValue({ count: 3 });
    db.callCampaign.findFirst.mockResolvedValue({
      id: 'camp-1',
      name: 'Avril',
      scope: CampaignScope.ALL,
      status: CampaignStatus.CLOSED,
      seed: 'seed',
      spreadDays: 1,
      createdById: ADMIN.id,
      createdAt: date,
      closedAt: date,
      createdBy: { fullName: ADMIN.fullName },
      commerciaux: [],
    });
    db.callTask.groupBy.mockResolvedValue([]);
    db.callAttempt.findMany.mockResolvedValue([]);

    await new Phase2CampaignsService(db as unknown as PrismaService, fakeDemoVisibility()).close(
      'camp-1',
    );

    const updateArgs = db.callCampaign.update.mock.calls[0] as readonly [unknown] | undefined;
    expect(updateArgs?.[0]).toMatchObject({
      where: { id: 'camp-1' },
      data: { status: CampaignStatus.CLOSED },
    });
    expect(db.callTask.updateMany).toHaveBeenCalledWith({
      where: { campaignId: 'camp-1', isActive: true },
      data: { status: CallTaskStatus.CANCELLED, isActive: false },
    });
    expect(db.scheduledCallback.updateMany).toHaveBeenCalledWith({
      where: { campaignId: 'camp-1', status: ScheduledCallbackStatus.PENDING },
      data: { status: ScheduledCallbackStatus.CANCELLED },
    });
  });

  it('une campagne déjà close ne réannule pas les rappels', async () => {
    const db = prismaStub();
    db.callCampaign.findFirst.mockResolvedValueOnce({ status: CampaignStatus.CLOSED });
    db.callCampaign.findFirst.mockResolvedValue({
      id: 'camp-1',
      name: 'Avril',
      scope: CampaignScope.ALL,
      status: CampaignStatus.CLOSED,
      seed: 'seed',
      spreadDays: 1,
      createdById: ADMIN.id,
      createdAt: date,
      closedAt: date,
      createdBy: { fullName: ADMIN.fullName },
      commerciaux: [],
    });
    db.callTask.groupBy.mockResolvedValue([]);
    db.callAttempt.findMany.mockResolvedValue([]);

    await new Phase2CampaignsService(db as unknown as PrismaService, fakeDemoVisibility()).close(
      'camp-1',
    );

    expect(db.scheduledCallback.updateMany).not.toHaveBeenCalled();
  });

  it('retourne le programme dans la position persistée, sans nom de prospect', async () => {
    const db = prismaStub();
    db.callCampaignCommercial.findUnique.mockResolvedValue({
      campaign: { name: 'Avril', scope: CampaignScope.BDD4, spreadDays: 1 },
      user: { fullName: 'Awa' },
    });
    db.callTask.findMany.mockResolvedValue([
      { position: 1, prospect: { id: 'prospect-1', phoneE164: '+221771234567' } },
      { position: 2, prospect: { id: 'prospect-2', phoneE164: '+221770000002' } },
    ]);

    const result = await new Phase2CampaignsService(
      db as unknown as PrismaService,
      fakeDemoVisibility(),
    ).programme('camp-1', 'com-1');

    expect(result.rows.map((row) => row.position)).toEqual([1, 2]);
    expect(result.rows[0]).toEqual({
      position: 1,
      shortCode: shortCode('prospect-1'),
      phoneE164: '+221771234567',
    });
    expect(result.rows[0]).not.toHaveProperty('name');
  });

  it('refuse la création sans commercial valide ou sans prospect éligible', async () => {
    const db = prismaStub();
    db.user.findMany.mockResolvedValue([]);
    const service = new Phase2CampaignsService(
      db as unknown as PrismaService,
      fakeDemoVisibility(),
    );

    await expect(
      service.create(ADMIN, {
        name: 'Avril',
        scope: CampaignScope.ALL,
        commercialIds: ['com-missing'],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    db.user.findMany.mockResolvedValue([
      { id: 'com-1', fullName: 'Awa', username: 'awa', role: Role.COMMERCIAL, isActive: true },
    ]);
    db.callCampaign.create.mockResolvedValue({ id: 'camp-1' });
    db.prospect.findMany.mockResolvedValue([]);

    await expect(
      service.create(ADMIN, {
        name: 'Avril',
        scope: CampaignScope.ALL,
        commercialIds: ['com-1'],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('MODE ÉTEINT, un compte de démonstration n’est pas ADMIS dans une campagne', async () => {
    const db = prismaStub();
    db.user.findMany.mockResolvedValue([]);
    const service = new Phase2CampaignsService(
      db as unknown as PrismaService,
      fakeDemoVisibility(false),
    );

    await expect(
      service.create(ADMIN, {
        name: 'Avril',
        scope: CampaignScope.ALL,
        commercialIds: ['demo-awa'],
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);

    const where = (db.user.findMany.mock.calls[0]?.[0] as { where?: Record<string, unknown> })
      .where;
    expect(where).toMatchObject({ isDemo: false });
  });

  it('mode ALLUMÉ, la clause disparaît et les deux populations se mêlent', async () => {
    const db = prismaStub();
    db.user.findMany.mockResolvedValue([]);
    const service = new Phase2CampaignsService(
      db as unknown as PrismaService,
      fakeDemoVisibility(true),
    );

    await service
      .create(ADMIN, { name: 'Avril', scope: CampaignScope.ALL, commercialIds: ['demo-awa'] })
      .catch(() => undefined);

    const where = (db.user.findMany.mock.calls[0]?.[0] as { where?: Record<string, unknown> })
      .where;
    expect(where).not.toHaveProperty('isDemo');
  });
});

describe('Phase2CampaignsService, étalement sur N jours', () => {
  it('découpe la file de CHAQUE commercial, pas la liste globale', async () => {
    const db = prismaStub();
    db.user.findMany.mockResolvedValue([
      { id: 'com-1', fullName: 'Awa', username: 'awa', role: Role.COMMERCIAL, isActive: true },
      { id: 'com-2', fullName: 'Bara', username: 'bara', role: Role.COMMERCIAL, isActive: true },
    ]);
    db.callCampaign.create.mockResolvedValue({ id: 'camp-1' });
    const ids = Array.from({ length: 12 }, (_, index) => ({ id: `p${String(index)}` }));
    db.prospect.findMany.mockResolvedValue(ids);
    db.$queryRawUnsafe = vi.fn().mockResolvedValue(ids);
    db.callCampaign.findFirst.mockResolvedValue({
      id: 'camp-1',
      name: 'Avril',
      scope: CampaignScope.ALL,
      status: CampaignStatus.ACTIVE,
      seed: 'seed',
      spreadDays: 3,
      createdById: ADMIN.id,
      createdAt: date,
      closedAt: null,
      createdBy: { fullName: ADMIN.fullName },
      commerciaux: [],
    });
    db.callTask.groupBy.mockResolvedValue([]);
    db.callAttempt.findMany.mockResolvedValue([]);

    await new Phase2CampaignsService(db as unknown as PrismaService, fakeDemoVisibility()).create(
      ADMIN,
      { name: 'Avril', scope: CampaignScope.ALL, commercialIds: ['com-1', 'com-2'], spreadDays: 3 },
    );

    const rows = (
      db.callTask.createMany.mock.calls[0] as [
        { data: { assignedToId: string; position: number; dayIndex: number }[] },
      ]
    )[0].data;

    for (const commercial of ['com-1', 'com-2']) {
      const days = rows
        .filter((row) => row.assignedToId === commercial)
        .sort((left, right) => left.position - right.position)
        .map((row) => row.dayIndex);
      expect(days).toEqual([0, 0, 1, 1, 2, 2]);
    }
  });

  it('laisse tout au jour 0 quand l’étalement n’est pas demandé', async () => {
    const db = prismaStub();
    db.user.findMany.mockResolvedValue([
      { id: 'com-1', fullName: 'Awa', username: 'awa', role: Role.COMMERCIAL, isActive: true },
    ]);
    db.callCampaign.create.mockResolvedValue({ id: 'camp-1' });
    const ids = [{ id: 'p0' }, { id: 'p1' }, { id: 'p2' }];
    db.prospect.findMany.mockResolvedValue(ids);
    db.$queryRawUnsafe = vi.fn().mockResolvedValue(ids);
    db.callCampaign.findFirst.mockResolvedValue({
      id: 'camp-1',
      name: 'Avril',
      scope: CampaignScope.ALL,
      status: CampaignStatus.ACTIVE,
      seed: 'seed',
      spreadDays: 1,
      createdById: ADMIN.id,
      createdAt: date,
      closedAt: null,
      createdBy: { fullName: ADMIN.fullName },
      commerciaux: [],
    });
    db.callTask.groupBy.mockResolvedValue([]);
    db.callAttempt.findMany.mockResolvedValue([]);

    await new Phase2CampaignsService(db as unknown as PrismaService, fakeDemoVisibility()).create(
      ADMIN,
      { name: 'Avril', scope: CampaignScope.ALL, commercialIds: ['com-1'] },
    );

    const rows = (db.callTask.createMany.mock.calls[0] as [{ data: { dayIndex: number }[] }])[0]
      .data;
    expect(rows.every((row) => row.dayIndex === 0)).toBe(true);
  });
});
