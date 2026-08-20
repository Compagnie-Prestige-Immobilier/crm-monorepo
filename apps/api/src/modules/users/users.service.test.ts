import { Role } from '@crm/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';
import { UsersService } from './users.service.js';

type MockFn = ReturnType<typeof vi.fn>;

interface MockDb {
  user: Record<'findFirst' | 'create' | 'update', MockFn>;
  refreshToken: Record<'updateMany', MockFn>;
}

const createdRow = (isDemo: boolean): Record<string, unknown> => ({
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
  isDemo,
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
      create: vi.fn().mockResolvedValue(createdRow(false)),
      update: vi.fn().mockResolvedValue(createdRow(false)),
    },
    refreshToken: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
  };
});

const dataOf = (): Record<string, unknown> =>
  (db.user.create.mock.calls[0]?.[0] as { data: Record<string, unknown> }).data;

const service = (demoEnabled: boolean): UsersService =>
  new UsersService(db as unknown as PrismaService, fakeDemoVisibility(demoEnabled));

describe('nature du compte créé', () => {
  it('mode ÉTEINT : le compte est réel', async () => {
    await service(false).create(saisie);
    expect(dataOf().isDemo).toBe(false);
  });

  it('mode ALLUMÉ : le compte est un compte de démonstration', async () => {
    await service(true).create(saisie);
    expect(dataOf().isDemo).toBe(true);
  });

  it('cherche le doublon d’identifiants SANS cloisonner', async () => {
    await service(true).create(saisie);

    const where = (db.user.findFirst.mock.calls[0]?.[0] as { where: Record<string, unknown> })
      .where;
    expect(where.isDemo).toBeUndefined();
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
    await service(false).update('usr-1', { role: Role.COMMERCIAL });

    expect(db.refreshToken.updateMany).toHaveBeenCalledTimes(1);
    const call = db.refreshToken.updateMany.mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
    };
    expect(call.where.userId).toBe('usr-1');
    expect(call.where.revokedAt).toBeNull();
  });

  it('ne révoque rien quand le rôle est réécrit à l’identique', async () => {
    await service(false).update('usr-1', { role: Role.ADMIN, fullName: 'Awa Diop' });

    expect(db.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('ne révoque rien quand le rôle n’est pas touché', async () => {
    await service(false).update('usr-1', { fullName: 'Awa Diop' });

    expect(db.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});

describe('cloisonnement des comptes réels', () => {
  beforeEach(() => {
    db.user.findFirst.mockResolvedValue(createdRow(false));
  });

  it('filtre aussi les accès directs quand le mode démonstration est éteint', async () => {
    const users = service(false);

    await users.get('usr-1');
    await users.update('usr-1', { fullName: 'Awa Ndiaye' });
    await users.resetPassword('usr-1', { password: 'nouveau-mot-de-passe' });
    await users.remove('usr-1', 'usr-admin');

    expect(db.user.findFirst).toHaveBeenCalledTimes(4);
    for (const [args] of db.user.findFirst.mock.calls) {
      expect((args as { where: Record<string, unknown> }).where).toMatchObject({
        id: 'usr-1',
        deletedAt: null,
        isDemo: false,
      });
    }
  });
});
