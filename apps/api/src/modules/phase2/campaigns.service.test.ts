import {
  BadRequestException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  CallOutcome,
  CallTaskStatus,
  CampaignScope,
  CampaignStatus,
  EnrollmentMethod,
  Role,
} from '@crm/database';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { shortCode } from '../../common/short-code.js';
import { Phase2CampaignsService, scopeLabel } from './campaigns.service.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';

type MockFn = ReturnType<typeof vi.fn>;

// Les clés sont énumérées une à une plutôt que `Record<string, MockFn>` :
// `noUncheckedIndexedAccess` rend tout accès indexé potentiellement `undefined`,
// et chaque `db.callTask.groupBy.mockResolvedValue(...)` deviendrait une erreur
// de compilation. L'énumération explicite a de surcroît le mérite de faire
// échouer le test quand le service se met à appeler une méthode non prévue,
// au lieu de renvoyer silencieusement `undefined`.
type MockDb = {
  callCampaign: Record<'count' | 'findMany' | 'findFirst' | 'create' | 'update', MockFn>;
  callCampaignCommercial: Record<'findUnique' | 'createMany', MockFn>;
  callTask: Record<'groupBy' | 'findMany' | 'updateMany' | 'createMany', MockFn>;
  callAttempt: Record<'findMany', MockFn>;
  prospect: Record<'findMany', MockFn>;
  user: Record<'findMany', MockFn>;
  $transaction: MockFn;
};

const ADMIN: AuthenticatedUser = {
  id: 'admin-1',
  email: 'admin@cpi.sn',
  username: 'admin',
  fullName: 'Admin CPI',
  role: Role.ADMIN,
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
    callTask: { groupBy: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), createMany: vi.fn() },
    callAttempt: { findMany: vi.fn() },
    prospect: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
    $transaction: vi.fn(),
  };
  // Prisma's interactive transaction callback is intentionally asynchronous.
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

describe('Phase2CampaignsService — parcours de campagne', () => {
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
    ).list({});

    expect(result.items[0]?.progress).toEqual({ total: 6, open: 3, done: 2, cancelled: 1 });
    expect(result.items[0]?.scopeLabel).toContain('CHUES');
    expect(result.meta).toEqual({ total: 1, page: 1, pageSize: 25, pageCount: 1 });
  });

  it('rend le détail avec progression par commercial et tentative récente', async () => {
    const db = prismaStub();
    db.callCampaign.findFirst.mockResolvedValue({
      id: 'camp-1',
      name: 'Avril',
      scope: CampaignScope.ALL,
      status: CampaignStatus.ACTIVE,
      seed: 'seed',
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
  });

  it('retourne le programme dans la position persistée, sans nom de prospect', async () => {
    const db = prismaStub();
    db.callCampaignCommercial.findUnique.mockResolvedValue({
      campaign: { name: 'Avril', scope: CampaignScope.BDD4 },
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
    ).rejects.toBeInstanceOf(BadRequestException);

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
});
