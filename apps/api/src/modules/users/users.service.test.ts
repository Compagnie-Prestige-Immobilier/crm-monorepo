import { Role } from '@crm/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { UsersService } from './users.service.js';

type MockFn = ReturnType<typeof vi.fn>;

interface MockDb {
  user: Record<'findFirst' | 'create' | 'update', MockFn>;
  refreshToken: Record<'updateMany', MockFn>;
}

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
    },
    refreshToken: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
});

const service = (): UsersService => new UsersService(db as unknown as PrismaService);

describe('nature du compte créé', () => {
  it('cherche le doublon d’identifiants SANS cloisonner', async () => {
    await service().create(saisie);

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
    await service().update('usr-1', { role: Role.COMMERCIAL });

    expect(db.refreshToken.updateMany).toHaveBeenCalledTimes(1);
    const call = db.refreshToken.updateMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
    };
    expect(call.where.userId).toBe('usr-1');
    expect(call.where.revokedAt).toBeNull();
  });

  it('ne révoque rien quand le rôle est réécrit à l’identique', async () => {
    await service().update('usr-1', { role: Role.ADMIN, fullName: 'Awa Diop' });

    expect(db.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('ne révoque rien quand le rôle n’est pas touché', async () => {
    await service().update('usr-1', { fullName: 'Awa Diop' });

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
    await users.update('usr-1', { fullName: 'Awa Ndiaye' });
    await users.resetPassword('usr-1', { password: 'nouveau-mot-de-passe' });
    await users.remove('usr-1', 'usr-admin');

    expect(db.user.findFirst).toHaveBeenCalledTimes(4);
    for (const [args] of db.user.findFirst.mock.calls) {
      expect((args as { where: Record<string, unknown> }).where).toMatchObject({
        id: 'usr-1',
        deletedAt: null,
      });
    }
  });
});
