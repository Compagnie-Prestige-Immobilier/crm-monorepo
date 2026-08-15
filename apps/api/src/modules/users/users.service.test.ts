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

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CHANGER LE RÔLE MET FIN À LA SESSION
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Seule la DÉSACTIVATION révoquait les jetons. Rétrograder un ADMIN le laissait
 * donc avec un refresh token valable des SEMAINES, avec lequel il obtenait à
 * volonté de nouveaux jetons d'accès. Le défaut se referme à deux endroits, et
 * aucun ne remplace l'autre :
 *
 *  · `FreshSessionGuard` relit le rôle en base sur les routes qui en exigent
 *    un, ce qui ferme la fenêtre du jeton DÉJÀ émis, quinze minutes ;
 *  · la révocation ci-dessous ferme la porte de derrière, celle du
 *    RENOUVELLEMENT, qui n'a pas de borne de temps utile.
 */
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

  /**
   * Contre-épreuve : révoquer sur CHAQUE modification déconnecterait un
   * administrateur qui corrige une faute de frappe dans son propre nom, et
   * ferait passer le test ci-dessus sans rien prouver.
   */
  it('ne révoque rien quand le rôle est réécrit à l’identique', async () => {
    await service(false).update('usr-1', { role: Role.ADMIN, fullName: 'Awa Diop' });

    expect(db.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('ne révoque rien quand le rôle n’est pas touché', async () => {
    await service(false).update('usr-1', { fullName: 'Awa Diop' });

    expect(db.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});
