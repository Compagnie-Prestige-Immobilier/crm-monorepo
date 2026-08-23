import { Role } from '@crm/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { UsersService } from './users.service.js';

type MockFn = ReturnType<typeof vi.fn>;

interface MockDb {
  user: Record<'findFirst' | 'create' | 'update' | 'count', MockFn>;
  refreshToken: Record<'updateMany', MockFn>;
  prospect: Record<'count' | 'updateMany', MockFn>;
  representant: Record<'count' | 'updateMany', MockFn>;
  callTask: Record<'updateMany', MockFn>;
  repCallTask: Record<'updateMany', MockFn>;
  auditLog: Record<'create', MockFn>;
  $transaction: MockFn;
}

const admin = { id: 'usr-admin' };

const createdRow = (): Record<string, unknown> => ({
  id: 'usr-1',
  email: 'awa@cpi.sn',
  username: 'awa',
  fullName: 'Awa Diop',
  role: Role.COMMERCIAL,
  isActive: true,
  departementId: null,
  departement: null,
  phoneE164: null,
  lastLoginAt: null,
  createdAt: new Date('2026-08-01T09:00:00.000Z'),
  _count: { prospects: 0 },
});

const saisie = {
  email: 'Awa@CPI.sn',
  username: 'Awa',
  fullName: 'Awa Diop',
  password: 'motdepasse-assez-long',
};

let db: MockDb;

beforeEach(() => {
  db = {
    user: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(createdRow()),
      update: vi.fn().mockResolvedValue(createdRow()),
      count: vi.fn().mockResolvedValue(1),
    },
    refreshToken: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    prospect: { count: vi.fn().mockResolvedValue(0), updateMany: vi.fn() },
    representant: { count: vi.fn().mockResolvedValue(0), updateMany: vi.fn() },
    callTask: { updateMany: vi.fn() },
    repCallTask: { updateMany: vi.fn() },
    auditLog: { create: vi.fn().mockResolvedValue({}) },
    // Un autre administrateur existe : les gardes « dernier admin » ne sont pas
    // le sujet de ces tests-ci.
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((run: (tx: unknown) => unknown) => run(db));
});

const service = (): UsersService => new UsersService(db as unknown as PrismaService);

describe('nature du compte créé', () => {
  it('cherche le doublon d’identifiants SANS cloisonner', async () => {
    await service().create(saisie, admin);

    const where = (db.user.findFirst.mock.calls[0]?.[0] as { where: Record<string, unknown> })
      .where;
    expect(where.OR).toEqual([{ email: 'awa@cpi.sn' }, { username: 'awa' }]);
  });
});

describe('sessions et changement de rôle', () => {
  const existing = {
    id: 'usr-1',
    email: 'awa@cpi.sn',
    username: 'awa',
    role: Role.ADMIN,
    isActive: true,
  };

  beforeEach(() => {
    db.user.findFirst.mockResolvedValue(existing);
  });

  it('révoque les jetons quand le rôle change', async () => {
    await service().update('usr-1', { role: Role.COMMERCIAL }, admin);

    expect(db.refreshToken.updateMany).toHaveBeenCalledTimes(1);
    const call = db.refreshToken.updateMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
    };
    expect(call.where.userId).toBe('usr-1');
    expect(call.where.revokedAt).toBeNull();
  });

  it('ne révoque rien quand le rôle est réécrit à l’identique', async () => {
    await service().update('usr-1', { role: Role.ADMIN, fullName: 'Awa Diop' }, admin);

    expect(db.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('ne révoque rien quand le rôle n’est pas touché', async () => {
    await service().update('usr-1', { fullName: 'Awa Diop' }, admin);

    expect(db.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});

describe('cloisonnement des comptes réels', () => {
  beforeEach(() => {
    db.user.findFirst.mockResolvedValue(createdRow());
  });

  it('filtre aussi les accès directs quand le mode démonstration est éteint', async () => {
    const users = service();

    await users.get('usr-1');
    await users.update('usr-1', { fullName: 'Awa Ndiaye' }, admin);
    await users.resetPassword('usr-1', { password: 'nouveau-mot-de-passe' }, admin);
    await users.remove('usr-1', admin);

    expect(db.user.findFirst).toHaveBeenCalledTimes(4);
    for (const [args] of db.user.findFirst.mock.calls) {
      expect((args as { where: Record<string, unknown> }).where).toMatchObject({
        id: 'usr-1',
        deletedAt: null,
      });
    }
  });
});

describe('un administrateur ne peut pas se retirer lui-même', () => {
  const seul = {
    id: 'usr-admin',
    email: 'admin@cpi.sn',
    username: 'admin',
    role: Role.ADMIN,
    isActive: true,
  };

  beforeEach(() => {
    db.user.findFirst.mockResolvedValue(seul);
  });

  it('se rétrograder est refusé', async () => {
    await expect(
      service().update('usr-admin', { role: Role.COMMERCIAL }, admin),
    ).rejects.toMatchObject({ response: { code: 'CANNOT_DEMOTE_SELF' } });
  });

  /// Sans cette garde la plateforme se retrouvait SANS administrateur :
  /// récupération par SQL direct uniquement.
  it('rétrograder le DERNIER administrateur est refusé', async () => {
    db.user.count.mockResolvedValue(0);

    await expect(
      service().update('usr-autre', { role: Role.COMMERCIAL }, { id: 'usr-tiers' }),
    ).rejects.toMatchObject({ response: { code: 'LAST_ADMIN' } });
  });

  it('rétrograder un administrateur quand un autre reste passe', async () => {
    db.user.count.mockResolvedValue(1);

    await expect(
      service().update('usr-autre', { role: Role.COMMERCIAL }, { id: 'usr-tiers' }),
    ).resolves.toBeDefined();
  });
});

describe('le portefeuille d’un compte désactivé est repris', () => {
  const commercial = {
    id: 'usr-1',
    email: 'awa@cpi.sn',
    username: 'awa',
    role: Role.COMMERCIAL,
    isActive: true,
  };

  beforeEach(() => {
    db.user.findFirst.mockResolvedValue(commercial);
  });

  it('sans repreneur désigné, la désactivation est refusée', async () => {
    db.prospect.count.mockResolvedValue(12);

    await expect(service().setActive('usr-1', { isActive: false }, admin)).rejects.toMatchObject({
      response: { code: 'HANDOVER_REQUIRED' },
    });
  });

  it('un compte sans fiche se désactive sans repreneur', async () => {
    await expect(service().setActive('usr-1', { isActive: false }, admin)).resolves.toBeDefined();
  });

  it('le repreneur doit être un commercial actif', async () => {
    db.prospect.count.mockResolvedValue(3);
    db.user.findFirst.mockImplementation((args: { where: { id: string } }): unknown =>
      args.where.id === 'usr-1' ? commercial : { id: 'usr-2', role: Role.DIRECTION },
    );

    await expect(
      service().setActive('usr-1', { isActive: false, handoverToId: 'usr-2' }, admin),
    ).rejects.toMatchObject({ response: { code: 'HANDOVER_TARGET_INVALID' } });
  });

  /// Les tâches suivent : laissées derrière, elles restent assignées à un compte
  /// qui ne se connectera plus et bloquent les fiches hors de tout tirage.
  it('fiches, représentants ET tâches passent au repreneur', async () => {
    db.prospect.count.mockResolvedValue(3);
    db.user.findFirst.mockImplementation((args: { where: { id: string } }): unknown =>
      args.where.id === 'usr-1'
        ? commercial
        : { id: 'usr-2', role: Role.COMMERCIAL, fullName: 'Bob' },
    );

    await service().setActive('usr-1', { isActive: false, handoverToId: 'usr-2' }, admin);

    for (const delegate of [db.prospect, db.representant]) {
      expect(delegate.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { createdById: 'usr-2' } }),
      );
    }
    for (const delegate of [db.callTask, db.repCallTask]) {
      expect(delegate.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ data: { assignedToId: 'usr-2' } }),
      );
    }
  });
});

describe('les gestes d’administration laissent une trace', () => {
  beforeEach(() => {
    db.user.findFirst.mockResolvedValue({
      id: 'usr-1',
      email: 'awa@cpi.sn',
      username: 'awa',
      role: Role.COMMERCIAL,
      isActive: true,
    });
  });

  it('un changement de rôle est journalisé sous son propre nom', async () => {
    await service().update('usr-1', { role: Role.SUPERVISEUR }, admin);

    const trace = db.auditLog.create.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(trace.data).toMatchObject({
      action: 'user.role_change',
      entity: 'user',
      entityId: 'usr-1',
      userId: 'usr-admin',
    });
  });

  it('création, réinitialisation et suppression écrivent chacune la leur', async () => {
    const users = service();
    db.user.findFirst.mockResolvedValueOnce(null);
    await users.create(saisie, admin);
    await users.resetPassword('usr-1', { password: 'nouveau-mot-de-passe' }, admin);
    await users.remove('usr-1', admin);

    const actions = db.auditLog.create.mock.calls.map(
      (call) => (call[0] as { data: { action: string } }).data.action,
    );
    expect(actions).toEqual(['user.create', 'user.reset_password', 'user.delete']);
  });
});
