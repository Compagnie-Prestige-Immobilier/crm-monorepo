import { Role } from '@crm/database';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { fakeDemoVisibility } from '../../prisma/fake-demo-visibility.js';
import { UsersService } from './users.service.js';

/**
 * La nature du compte, à la création.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * LE DÉFAUT CORRIGÉ
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `create` n'écrivait pas `isDemo`. La colonne prenait son défaut, FALSE, et le
 * compte ouvert pendant une démonstration devenait un VRAI compte : listé dans
 * l'administration une fois le mode éteint, connectable, et que rien ne
 * désigne comme fictif.
 *
 * L'asymétrie était la partie gênante : la liste des comptes, elle, cloisonnait
 * DÉJÀ par `demoScope`. Le compte créé en démonstration disparaissait donc de
 * l'écran qui aurait permis de le voir, tout en restant en base et utilisable.
 *
 * Un compte est une RACINE : aucune ligne source dont hériter, l'interrupteur
 * décide seul.
 */

type MockFn = ReturnType<typeof vi.fn>;

interface MockDb {
  user: Record<'findFirst' | 'create', MockFn>;
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
    },
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

  /**
   * Le contrôle d'unicité, lui, reste GLOBAL et doit le rester : les index
   * uniques sur `email` et `username` ne connaissent pas le mode. Filtré, il
   * déclarerait libre une adresse que la base refuse ensuite, et l'appelant
   * recevrait un 500 opaque au lieu du 409 nommant le champ en cause.
   */
  it('cherche le doublon d’identifiants SANS cloisonner', async () => {
    await service(true).create(saisie);

    const where = (db.user.findFirst.mock.calls[0]?.[0] as { where: Record<string, unknown> })
      .where;
    expect(where.isDemo).toBeUndefined();
    expect(where.OR).toEqual([{ email: 'awa@cpi.sn' }, { username: 'awa' }]);
  });
});
