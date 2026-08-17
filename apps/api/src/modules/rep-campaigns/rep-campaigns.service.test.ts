import {
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { CallTaskStatus, CampaignStatus, RepCallOutcome, Role } from '@crm/database';
import { describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { shortCode } from '../../common/short-code.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';
import { REP_CHECKBOX_GROUPS, RepCampaignsService } from './rep-campaigns.service.js';
import { RepCallAttemptApplyStatus } from './dto.js';

type MockFn = ReturnType<typeof vi.fn>;

type MockDb = {
  repCallCampaign: Record<'count' | 'findMany' | 'findFirst' | 'create' | 'update', MockFn>;
  repCallCampaignCommercial: Record<'findUnique' | 'createMany', MockFn>;
  repCallTask: Record<
    'groupBy' | 'findMany' | 'findFirst' | 'count' | 'updateMany' | 'createMany' | 'update',
    MockFn
  >;
  repCallAttempt: Record<'findMany' | 'findUnique' | 'create' | 'createMany', MockFn>;
  representant: Record<'findMany' | 'findFirst' | 'count', MockFn>;
  departement: Record<'findUnique', MockFn>;
  ief: Record<'findUnique', MockFn>;
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

const COMMERCIAL: AuthenticatedUser = {
  id: 'com-1',
  email: 'awa@cpi.sn',
  username: 'awa',
  fullName: 'Awa Sy',
  role: Role.COMMERCIAL,
};

const date = new Date('2026-04-08T14:30:00.000Z');

function prismaStub(): MockDb {
  const db: MockDb = {
    repCallCampaign: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    repCallCampaignCommercial: { findUnique: vi.fn(), createMany: vi.fn() },
    repCallTask: {
      groupBy: vi.fn().mockResolvedValue([]),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      count: vi.fn().mockResolvedValue(100),
      updateMany: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
    },
    repCallAttempt: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      create: vi.fn(),
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    representant: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
    departement: { findUnique: vi.fn() },
    ief: { findUnique: vi.fn() },
    user: { findMany: vi.fn() },
    $transaction: vi.fn(),
    $executeRawUnsafe: vi.fn(),
    $queryRawUnsafe: vi.fn(),
  };
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  db.$transaction.mockImplementation((run: (tx: MockDb) => Promise<unknown>) => run(db));
  return db;
}

const build = (db: MockDb): RepCampaignsService =>
  new RepCampaignsService(db as unknown as PrismaService, fakeDemoVisibility());

const campaignRow = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: 'camp-1',
  name: 'Relance dormants',
  status: CampaignStatus.ACTIVE,
  seed: 'seed',
  spreadDays: 1,
  departementId: null,
  iefId: null,
  onlyWithoutProspects: false,
  createdById: ADMIN.id,
  createdAt: date,
  closedAt: null,
  createdBy: { fullName: ADMIN.fullName },
  departement: null,
  ief: null,
  commerciaux: [],
  ...over,
});

describe('RepCampaignsService : création', () => {
  it('refuse un destinataire introuvable, d’un autre rôle, ou désactivé, en 422', async () => {
    const db = prismaStub();
    const service = build(db);
    const body = { name: 'Relance', commercialIds: ['com-1'] };

    db.user.findMany.mockResolvedValue([]);
    await expect(service.create(ADMIN, body)).rejects.toBeInstanceOf(UnprocessableEntityException);

    db.user.findMany.mockResolvedValue([
      { id: 'com-1', fullName: 'Awa', username: 'awa', role: Role.ADMIN, isActive: true },
    ]);
    await expect(service.create(ADMIN, body)).rejects.toBeInstanceOf(UnprocessableEntityException);

    db.user.findMany.mockResolvedValue([
      { id: 'com-1', fullName: 'Awa', username: 'awa', role: Role.COMMERCIAL, isActive: false },
    ]);
    await expect(service.create(ADMIN, body)).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('refuse un périmètre sans aucun représentant éligible', async () => {
    const db = prismaStub();
    db.user.findMany.mockResolvedValue([
      { id: 'com-1', fullName: 'Awa', username: 'awa', role: Role.COMMERCIAL, isActive: true },
    ]);
    db.repCallCampaign.create.mockResolvedValue({ id: 'camp-1' });
    db.representant.findMany.mockResolvedValue([]);

    await expect(
      build(db).create(ADMIN, { name: 'Relance', commercialIds: ['com-1'] }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it('n’écrit AUCUNE tâche active sur un représentant déjà affecté', async () => {
    const db = prismaStub();
    db.user.findMany.mockResolvedValue([
      { id: 'com-1', fullName: 'Awa', username: 'awa', role: Role.COMMERCIAL, isActive: true },
    ]);
    db.repCallCampaign.create.mockResolvedValue({ id: 'camp-1' });
    db.representant.findMany.mockResolvedValue([{ id: 'rep-1' }]);
    db.$queryRawUnsafe.mockResolvedValue([{ id: 'rep-1' }]);
    db.repCallCampaign.findFirst.mockResolvedValue(campaignRow());

    await build(db).create(ADMIN, { name: 'Relance', commercialIds: ['com-1'] });

    const where = (
      db.representant.findMany.mock.calls[0] as [{ where: Record<string, unknown> }]
    )[0].where;
    expect(where).toMatchObject({
      deletedAt: null,
      isDemo: false,
      repCallTasks: { none: { isActive: true } },
    });
  });

  it('EXCLUT un représentant dont un appel a déjà abouti à une issue terminale', async () => {
    const db = prismaStub();
    db.user.findMany.mockResolvedValue([
      { id: 'com-1', fullName: 'Awa', username: 'awa', role: Role.COMMERCIAL, isActive: true },
    ]);
    db.repCallCampaign.create.mockResolvedValue({ id: 'camp-1' });
    db.representant.findMany.mockResolvedValue([{ id: 'rep-1' }]);
    db.$queryRawUnsafe.mockResolvedValue([{ id: 'rep-1' }]);
    db.repCallCampaign.findFirst.mockResolvedValue(campaignRow());

    await build(db).create(ADMIN, { name: 'Relance', commercialIds: ['com-1'] });

    const where = (
      db.representant.findMany.mock.calls[0] as [{ where: Record<string, unknown> }]
    )[0].where;
    const terminal = (where.repCallAttempts as { none: { outcome: { in: string[] } } }).none.outcome
      .in;
    expect(terminal).toContain(RepCallOutcome.REFUSED);
    expect(terminal).toContain(RepCallOutcome.WRONG_NUMBER);
    expect(terminal).toContain(RepCallOutcome.REACHED);
    expect(terminal).not.toContain(RepCallOutcome.CALLBACK);
    expect(terminal).not.toContain(RepCallOutcome.UNREACHABLE);
  });

  it('MARQUE la campagne et ses tâches quand le mode démonstration est allumé', async () => {
    const db = prismaStub();
    db.user.findMany.mockResolvedValue([
      { id: 'com-1', fullName: 'Awa', username: 'awa', role: Role.COMMERCIAL, isActive: true },
    ]);
    db.repCallCampaign.create.mockResolvedValue({ id: 'camp-1' });
    db.representant.findMany.mockResolvedValue([{ id: 'rep-1' }]);
    db.$queryRawUnsafe.mockResolvedValue([{ id: 'rep-1' }]);
    db.repCallCampaign.findFirst.mockResolvedValue(campaignRow());

    const service = new RepCampaignsService(
      db as unknown as PrismaService,
      fakeDemoVisibility(true),
    );
    await service.create(ADMIN, { name: 'Relance', commercialIds: ['com-1'] });

    const campaign = (
      db.repCallCampaign.create.mock.calls[0] as [{ data: Record<string, unknown> }]
    )[0];
    expect(campaign.data.isDemo).toBe(true);

    const tasks = (
      db.repCallTask.createMany.mock.calls[0] as [{ data: Record<string, unknown>[] }]
    )[0];
    expect(tasks.data[0]?.isDemo).toBe(true);
  });

  it('ÉTALE la file de chaque commercial en tranches contiguës', async () => {
    const db = prismaStub();
    db.user.findMany.mockResolvedValue([
      { id: 'com-1', fullName: 'Awa', username: 'awa', role: Role.COMMERCIAL, isActive: true },
    ]);
    db.repCallCampaign.create.mockResolvedValue({ id: 'camp-1' });
    const ids = Array.from({ length: 9 }, (_, index) => ({ id: `rep-${String(index)}` }));
    db.representant.findMany.mockResolvedValue(ids);
    db.$queryRawUnsafe.mockResolvedValue(ids);
    db.repCallCampaign.findFirst.mockResolvedValue(campaignRow({ spreadDays: 3 }));

    await build(db).create(ADMIN, {
      name: 'Relance',
      commercialIds: ['com-1'],
      spreadDays: 3,
    });

    const rows = (
      db.repCallTask.createMany.mock.calls[0] as [
        { data: { position: number; dayIndex: number }[] },
      ]
    )[0].data;
    expect(rows.map((row) => row.dayIndex)).toEqual([0, 0, 0, 1, 1, 1, 2, 2, 2]);
    expect(rows.map((row) => row.position)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  const creerCampagne = async (
    targets: number,
    commerciaux: string[],
    spreadDays?: number,
  ): Promise<{ position: number; dayIndex: number; assignedToId: string }[]> => {
    const db = prismaStub();
    db.user.findMany.mockResolvedValue(
      commerciaux.map((id) => ({
        id,
        fullName: id,
        username: id,
        role: Role.COMMERCIAL,
        isActive: true,
      })),
    );
    db.repCallCampaign.create.mockResolvedValue({ id: 'camp-1' });
    const ids = Array.from({ length: targets }, (_, index) => ({ id: `rep-${String(index)}` }));
    db.representant.findMany.mockResolvedValue(ids);
    db.$queryRawUnsafe.mockResolvedValue(ids);
    db.repCallCampaign.findFirst.mockResolvedValue(campaignRow({ spreadDays: spreadDays ?? 1 }));

    await build(db).create(ADMIN, {
      name: 'Relance',
      commercialIds: commerciaux,
      ...(spreadDays === undefined ? {} : { spreadDays }),
    });

    return (
      db.repCallTask.createMany.mock.calls[0] as [
        { data: { position: number; dayIndex: number; assignedToId: string }[] },
      ]
    )[0].data;
  };

  it('spreadDays = 1 : tout le monde au jour 0, positions intactes', async () => {
    const rows = await creerCampagne(5, ['com-1'], 1);

    expect(rows.map((row) => row.dayIndex)).toEqual([0, 0, 0, 0, 0]);
    expect(rows.map((row) => row.position)).toEqual([1, 2, 3, 4, 5]);
  });

  it('spreadDays = 31 : chaque journée est servie, aucun indice hors bornes', async () => {
    const rows = await creerCampagne(62, ['com-1'], 31);

    const indices = rows.map((row) => row.dayIndex);
    expect(Math.min(...indices)).toBe(0);
    expect(Math.max(...indices)).toBe(30);
    expect(new Set(indices).size).toBe(31);
    for (let jour = 0; jour < 31; jour += 1) {
      expect(indices.filter((index) => index === jour)).toHaveLength(2);
    }
  });

  it('spreadDays = 31 avec MOINS de fiches que de journées : rien au delà du réel', async () => {
    const rows = await creerCampagne(4, ['com-1'], 31);

    expect(rows.map((row) => row.dayIndex)).toEqual([0, 1, 2, 3]);
  });

  it('plus de commerciaux que de fiches : les seaux en trop restent VIDES', async () => {
    const rows = await creerCampagne(2, ['com-1', 'com-2', 'com-3', 'com-4', 'com-5'], 3);

    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.assignedToId)).toEqual(['com-1', 'com-2']);
    expect(rows.map((row) => row.position)).toEqual([1, 1]);
    expect(rows.map((row) => row.dayIndex)).toEqual([0, 0]);
  });

  it('une seule fiche pour dix commerciaux n’écrit qu’une tâche', async () => {
    const rows = await creerCampagne(
      1,
      Array.from({ length: 10 }, (_, index) => `com-${String(index + 1)}`),
      31,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ assignedToId: 'com-1', position: 1, dayIndex: 0 });
  });

  it('journalise les tâches dont le jour sort des bornes, au lieu de les taire', async () => {
    const db = prismaStub();
    db.repCallCampaign.findFirst.mockResolvedValue(campaignRow({ spreadDays: 2 }));
    db.repCallTask.groupBy.mockResolvedValue([
      { assignedToId: 'com-1', dayIndex: 0, _count: { _all: 4 } },
      { assignedToId: 'com-1', dayIndex: 5, _count: { _all: 7 } },
    ]);

    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const result = await build(db).get('camp-1');
    const message = warn.mock.calls.map((call) => String(call[0])).join('\n');
    warn.mockRestore();

    expect(result.perDay).toEqual([4, 0]);
    expect(message).toContain('camp-1');
    expect(message).toContain('jour 5');
    expect(message).toContain('2 journée(s)');
  });

  it('traduit le conflit d’unicité en refus exploitable, jamais en 500', async () => {
    const db = prismaStub();
    db.user.findMany.mockResolvedValue([
      { id: 'com-1', fullName: 'Awa', username: 'awa', role: Role.COMMERCIAL, isActive: true },
    ]);
    db.$transaction.mockRejectedValue(Object.assign(new Error('unique'), { code: 'P2002' }));

    await expect(
      build(db).create(ADMIN, { name: 'Relance', commercialIds: ['com-1'] }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('RepCampaignsService : lecture', () => {
  it('reconstruit la progression et la répartition par journée depuis les tâches', async () => {
    const db = prismaStub();
    db.repCallCampaign.findFirst.mockResolvedValue(
      campaignRow({
        spreadDays: 2,
        commerciaux: [{ position: 1, user: { id: 'com-1', fullName: 'Awa', username: 'awa' } }],
      }),
    );
    db.repCallTask.groupBy
      .mockResolvedValueOnce([
        { assignedToId: 'com-1', status: CallTaskStatus.OPEN, _count: { _all: 3 } },
        { assignedToId: 'com-1', status: CallTaskStatus.DONE, _count: { _all: 1 } },
      ])
      .mockResolvedValueOnce([
        { assignedToId: 'com-1', dayIndex: 0, _count: { _all: 2 } },
        { assignedToId: 'com-1', dayIndex: 1, _count: { _all: 2 } },
      ]);

    const result = await build(db).get('camp-1');

    expect(result.progress).toEqual({ total: 4, open: 3, done: 1, cancelled: 0 });
    expect(result.perDay).toEqual([2, 2]);
    expect(result.commerciaux[0]?.perDay).toEqual([2, 2]);
  });

  it('ignore une journée hors bornes plutôt que d’allonger le tableau', async () => {
    const db = prismaStub();
    db.repCallCampaign.findFirst.mockResolvedValue(campaignRow({ spreadDays: 2 }));
    db.repCallTask.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ assignedToId: 'com-1', dayIndex: 5, _count: { _all: 7 } }]);

    const result = await build(db).get('camp-1');
    expect(result.perDay).toEqual([0, 0]);
  });

  it('refuse un détail inexistant avec un code métier stable', async () => {
    const db = prismaStub();
    db.repCallCampaign.findFirst.mockResolvedValue(null);
    await expect(build(db).get('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('compose un libellé de périmètre lisible', async () => {
    const db = prismaStub();
    db.repCallCampaign.findFirst.mockResolvedValue(
      campaignRow({
        departement: { name: 'Dakar' },
        ief: { name: 'Almadies' },
        onlyWithoutProspects: true,
      }),
    );
    db.repCallTask.groupBy.mockResolvedValue([]);

    const result = await build(db).get('camp-1');
    expect(result.scopeLabel).toBe('Département Dakar, IEF Almadies, sans prospect');
  });

  it('annonce « tous les représentants » quand aucune borne n’est posée', async () => {
    const db = prismaStub();
    db.representant.count.mockResolvedValue(100);
    const preview = await build(db).preview({ commercialCount: 4, spreadDays: 5 });

    expect(preview.eligible).toBe(100);
    expect(preview.perCommercial).toBe(25);
    expect(preview.perDay).toEqual([5, 5, 5, 5, 5]);
    expect(preview.scopeLabel).toBe('Tous les représentants');
  });

  it('aperçu et détail publient un perDay de MÊME longueur', async () => {
    const spreadDays = 6;

    const previewDb = prismaStub();
    previewDb.representant.count.mockResolvedValue(3);
    const preview = await build(previewDb).preview({ commercialCount: 1, spreadDays });

    const detailDb = prismaStub();
    detailDb.repCallCampaign.findFirst.mockResolvedValue(campaignRow({ spreadDays }));
    detailDb.repCallTask.groupBy.mockResolvedValue([]);
    const detail = await build(detailDb).get('camp-1');

    expect(preview.perDay).toHaveLength(spreadDays);
    expect(detail.perDay).toHaveLength(spreadDays);
    expect(preview.perDay).toHaveLength(detail.perDay.length);
  });
});

describe('RepCampaignsService : clôture', () => {
  it('remet isActive à faux, sans quoi les représentants resteraient bloqués', async () => {
    const db = prismaStub();
    db.repCallCampaign.findFirst
      .mockResolvedValueOnce({ status: CampaignStatus.ACTIVE })
      .mockResolvedValue(campaignRow({ status: CampaignStatus.CLOSED, closedAt: date }));
    db.repCallCampaign.update.mockResolvedValue({});
    db.repCallTask.updateMany.mockResolvedValue({ count: 3 });

    await build(db).close('camp-1');

    expect(db.repCallTask.updateMany).toHaveBeenCalledWith({
      where: { campaignId: 'camp-1', isActive: true },
      data: { status: CallTaskStatus.CANCELLED, isActive: false },
    });
  });

  it('est idempotente : une campagne déjà close ne relance rien', async () => {
    const db = prismaStub();
    db.repCallCampaign.findFirst
      .mockResolvedValueOnce({ status: CampaignStatus.CLOSED })
      .mockResolvedValue(campaignRow({ status: CampaignStatus.CLOSED }));

    await build(db).close('camp-1');

    expect(db.repCallCampaign.update).not.toHaveBeenCalled();
    expect(db.repCallTask.updateMany).not.toHaveBeenCalled();
  });
});

describe('RepCampaignsService : programme', () => {
  it('rend les lignes dans la position persistée, SANS aucun nom', async () => {
    const db = prismaStub();
    db.repCallCampaignCommercial.findUnique.mockResolvedValue({
      campaign: {
        name: 'Relance',
        spreadDays: 1,
        onlyWithoutProspects: false,
        departement: null,
        ief: null,
      },
      user: { fullName: 'Awa' },
    });
    db.repCallTask.findMany.mockResolvedValue([
      { position: 1, representant: { id: 'rep-1', phoneE164: '+221771234567' } },
      { position: 2, representant: { id: 'rep-2', phoneE164: '+221770000002' } },
    ]);

    const result = await build(db).programme('camp-1', 'com-1');

    expect(result.rows).toEqual([
      { position: 1, shortCode: shortCode('rep-1'), phoneE164: '+221771234567' },
      { position: 2, shortCode: shortCode('rep-2'), phoneE164: '+221770000002' },
    ]);
    expect(result.rows[0]).not.toHaveProperty('fullName');
    expect(result.dayNumber).toBeUndefined();
  });

  it('filtre sur la journée demandée et porte le « Jour N sur M »', async () => {
    const db = prismaStub();
    db.repCallCampaignCommercial.findUnique.mockResolvedValue({
      campaign: {
        name: 'Relance',
        spreadDays: 7,
        onlyWithoutProspects: false,
        departement: null,
        ief: null,
      },
      user: { fullName: 'Awa' },
    });
    db.repCallTask.findMany.mockResolvedValue([]);

    const result = await build(db).programme('camp-1', 'com-1', 3);

    expect(result.dayNumber).toBe(3);
    expect(result.dayCount).toBe(7);
    const args = (db.repCallTask.findMany.mock.calls[0] as [{ where: Record<string, unknown> }])[0];
    expect(args.where).toMatchObject({ dayIndex: 2 });
  });

  it('REFUSE une journée au-delà de l’étalement au lieu de rendre un PDF vide', async () => {
    const db = prismaStub();
    db.repCallCampaignCommercial.findUnique.mockResolvedValue({
      campaign: {
        name: 'Relance',
        spreadDays: 2,
        onlyWithoutProspects: false,
        departement: null,
        ief: null,
      },
      user: { fullName: 'Awa' },
    });

    await expect(build(db).programme('camp-1', 'com-1', 5)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('REFUSE une journée au-delà de l’étalement EFFECTIF de ce commercial', async () => {
    const db = prismaStub();
    db.repCallCampaignCommercial.findUnique.mockResolvedValue({
      campaign: {
        name: 'Relance',
        spreadDays: 7,
        onlyWithoutProspects: false,
        departement: null,
        ief: null,
      },
      user: { fullName: 'Awa' },
    });
    db.repCallTask.count.mockResolvedValue(3);

    await expect(build(db).programme('camp-1', 'com-1', 5)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const jour3 = await build(db).programme('camp-1', 'com-1', 3);
    expect(jour3.dayNumber).toBe(3);

    const dernier = db.repCallTask.findMany.mock.calls.at(-1) as [
      { where: Record<string, unknown> },
    ];
    expect(dernier[0].where).toMatchObject({ dayIndex: 2, assignedToId: 'com-1' });

    expect(jour3.dayCount).toBe(3);
  });

  it('REFUSE une journée nulle ou négative', async () => {
    const db = prismaStub();
    db.repCallCampaignCommercial.findUnique.mockResolvedValue({
      campaign: {
        name: 'Relance',
        spreadDays: 7,
        onlyWithoutProspects: false,
        departement: null,
        ief: null,
      },
      user: { fullName: 'Awa' },
    });

    await expect(build(db).programme('camp-1', 'com-1', 0)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('ne distingue pas « campagne inconnue » de « commercial hors campagne »', async () => {
    const db = prismaStub();
    db.repCallCampaignCommercial.findUnique.mockResolvedValue(null);
    await expect(build(db).programme('camp-1', 'com-1')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('RepCampaignsService : tentatives', () => {
  const attempt = {
    id: '01931f3c-1a2b-7c4d-8e5f-000000000001',
    representantId: 'rep-1',
    outcome: RepCallOutcome.REACHED,
    clientCreatedAt: date.toISOString(),
  };

  it('clôt la tâche sur une issue terminale', async () => {
    const db = prismaStub();
    db.repCallAttempt.findUnique.mockResolvedValue(null);
    db.representant.findFirst.mockResolvedValue({ id: 'rep-1' });
    db.repCallTask.findFirst.mockResolvedValue({ id: 'task-1', campaignId: 'camp-1' });

    const result = await build(db).recordAttempt(COMMERCIAL, attempt);

    expect(result.status).toBe(RepCallAttemptApplyStatus.APPLIED);
    expect(result.taskClosed).toBe(true);
    const update = (
      db.repCallTask.updateMany.mock.calls[0] as [
        { where: Record<string, unknown>; data: Record<string, unknown> },
      ]
    )[0];
    expect(update.where).toMatchObject({ representantId: 'rep-1', isActive: true });
    expect(update.data).toMatchObject({ status: CallTaskStatus.DONE, isActive: false });
  });

  it('rend DUPLICATE quand l’écriture est écartée par l’unicité', async () => {
    const db = prismaStub();
    db.repCallAttempt.findUnique.mockResolvedValue(null);
    db.representant.findFirst.mockResolvedValue({ id: 'rep-1' });
    db.repCallTask.findFirst.mockResolvedValue({ id: 'task-1', campaignId: 'camp-1' });
    db.repCallAttempt.createMany.mockResolvedValue({ count: 0 });

    const result = await build(db).recordAttempt(COMMERCIAL, attempt);

    expect(result.status).toBe(RepCallAttemptApplyStatus.DUPLICATE);
    expect(result.taskClosed).toBe(false);
    expect(db.repCallTask.updateMany).not.toHaveBeenCalled();
  });

  it('LAISSE la tâche ouverte sur « rappeler » et « injoignable »', async () => {
    for (const outcome of [RepCallOutcome.CALLBACK, RepCallOutcome.UNREACHABLE]) {
      const db = prismaStub();
      db.repCallAttempt.findUnique.mockResolvedValue(null);
      db.representant.findFirst.mockResolvedValue({ id: 'rep-1' });
      db.repCallTask.findFirst.mockResolvedValue({ id: 'task-1', campaignId: 'camp-1' });

      const result = await build(db).recordAttempt(COMMERCIAL, { ...attempt, outcome });

      expect(result.taskClosed).toBe(false);
      expect(db.repCallTask.update).not.toHaveBeenCalled();
    }
  });

  it('EST IDEMPOTENTE : un rejeu ne compte pas deux appels', async () => {
    const db = prismaStub();
    db.repCallAttempt.findUnique.mockResolvedValue({ id: attempt.id, taskId: 'task-1' });

    const result = await build(db).recordAttempt(COMMERCIAL, attempt);

    expect(result.status).toBe(RepCallAttemptApplyStatus.DUPLICATE);
    expect(db.repCallAttempt.create).not.toHaveBeenCalled();
    expect(db.repCallTask.update).not.toHaveBeenCalled();
  });

  it('accepte une tentative HORS campagne et la conserve', async () => {
    const db = prismaStub();
    db.repCallAttempt.findUnique.mockResolvedValue(null);
    db.representant.findFirst.mockResolvedValue({ id: 'rep-1' });
    db.repCallTask.findFirst.mockResolvedValue(null);

    const result = await build(db).recordAttempt(COMMERCIAL, attempt);

    expect(result.status).toBe(RepCallAttemptApplyStatus.APPLIED);
    expect(result.taskId).toBeNull();
    expect(db.repCallAttempt.createMany).toHaveBeenCalled();
  });

  it('écrit isDemo depuis le REPRÉSENTANT, mode démonstration allumé', async () => {
    const db = prismaStub();
    db.repCallAttempt.findUnique.mockResolvedValue(null);
    db.representant.findFirst.mockResolvedValue({ id: 'rep-1', isDemo: false });
    db.repCallTask.findFirst.mockResolvedValue(null);

    const service = new RepCampaignsService(
      db as unknown as PrismaService,
      fakeDemoVisibility(true),
    );
    await service.recordAttempt(COMMERCIAL, attempt);

    const written = (
      db.repCallAttempt.createMany.mock.calls[0] as [{ data: Record<string, unknown>[] }]
    )[0].data[0];
    expect(written?.isDemo).toBe(false);
  });

  it('et le suit AUSSI quand la fiche appelée est fictive', async () => {
    const db = prismaStub();
    db.repCallAttempt.findUnique.mockResolvedValue(null);
    db.representant.findFirst.mockResolvedValue({ id: 'rep-1', isDemo: true });
    db.repCallTask.findFirst.mockResolvedValue(null);

    const service = new RepCampaignsService(
      db as unknown as PrismaService,
      fakeDemoVisibility(true),
    );
    await service.recordAttempt(COMMERCIAL, attempt);

    const written = (
      db.repCallAttempt.createMany.mock.calls[0] as [{ data: Record<string, unknown>[] }]
    )[0].data[0];
    expect(written?.isDemo).toBe(true);
  });

  it('exige un commentaire sur « Autre » et refuse une promesse hors contexte', async () => {
    const db = prismaStub();
    const service = build(db);

    await expect(
      service.recordAttempt(COMMERCIAL, { ...attempt, outcome: RepCallOutcome.OTHER }),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      service.recordAttempt(COMMERCIAL, { ...attempt, promisedProspects: 12 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse une tentative sur un représentant inconnu', async () => {
    const db = prismaStub();
    db.repCallAttempt.findUnique.mockResolvedValue(null);
    db.representant.findFirst.mockResolvedValue(null);

    await expect(build(db).recordAttempt(COMMERCIAL, attempt)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});

describe('REP_CHECKBOX_GROUPS', () => {
  const ATTENDUS: Record<RepCallOutcome, string> = {
    [RepCallOutcome.REACHED]: 'Échange fait',
    [RepCallOutcome.PROSPECTS_PROMISED]: 'Fiches promises',
    [RepCallOutcome.UNREACHABLE]: 'Injoignable',
    [RepCallOutcome.CALLBACK]: 'Rappeler',
    [RepCallOutcome.REFUSED]: 'Refus',
    [RepCallOutcome.WRONG_NUMBER]: 'Faux numéro',
    [RepCallOutcome.OTHER]: 'Autre',
  };

  const labels = (): string[] => REP_CHECKBOX_GROUPS.flatMap((group) => group.options);

  it.each(Object.entries(ATTENDUS))('%s porte le libellé « %s »', (_issue, libelle) => {
    expect(labels()).toContain(libelle);
  });

  it('n’imprime AUCUNE case qui ne corresponde à une issue', () => {
    expect(labels().sort()).toEqual(Object.values(ATTENDUS).sort());
  });

  it('la table de correspondance couvre l’énumération en ENTIER', () => {
    expect(Object.keys(ATTENDUS).sort()).toEqual(Object.keys(RepCallOutcome).sort());
  });

  it('sépare ce que l’appel a DONNÉ de ce qui l’a empêché', () => {
    expect(REP_CHECKBOX_GROUPS.map((group) => group.caption)).toEqual(['Résultat', 'Autre']);
    expect(REP_CHECKBOX_GROUPS[0]?.options).toEqual([
      ATTENDUS[RepCallOutcome.REACHED],
      ATTENDUS[RepCallOutcome.PROSPECTS_PROMISED],
    ]);
  });
});
