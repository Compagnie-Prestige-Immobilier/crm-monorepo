import { Controller, Get, Global, Module, VersioningType } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { Role } from '@crm/database';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { CurrentUser, type AuthenticatedUser } from '../decorators/current-user.decorator.js';
import { Roles } from '../decorators/roles.decorator.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { FreshSessionGuard } from './fresh-session.guard.js';
import { RolesGuard } from './roles.guard.js';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LE JETON DIT CE QUI ÉTAIT VRAI. LA BASE DIT CE QUI L'EST.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le jeton d'accès PORTE le rôle. Il est signé, donc infalsifiable, et FIGÉ,
 * donc périmable : `RolesGuard` comparait `@Roles(...)` à une affirmation
 * vieille de quinze minutes au plus. Deux conséquences, et toutes deux
 * dépassent largement l'export de la base, qui n'a fait que les révéler :
 *
 *  · rétrograder un ADMIN ne lui retirait RIEN dans l'immédiat. Il gardait
 *    l'autorité d'administrateur sur toutes les routes ADMIN du dépôt jusqu'à
 *    l'expiration de son jeton. Pour un compte compromis ou un départ en
 *    urgence, ce quart d'heure porte sur la gestion des comptes, la purge de la
 *    base et l'export intégral ;
 *  · le compte `demo.admin@cpi.sn` est semé ADMIN, avec un mot de passe publié
 *    dans ce dépôt. L'émission d'une session lui est désormais refusée quand la
 *    démonstration est éteinte, mais un jeton obtenu PENDANT la démonstration
 *    continuait de vivre après l'extinction, avec l'autorité ADMIN, sur les
 *    données RÉELLES. C'est exactement le jeton qu'un visiteur de passage peut
 *    emporter.
 *
 * Le montage embarque les gardes RÉELLES, dans l'ordre de `app.module.ts`, et
 * une route ADMIN témoin. Ce qui est doublé est la base et la lecture du
 * réglage de démonstration ; la décision, elle, est exercée pour de bon.
 */

const ADMIN_URL = '/api/v1/essai/admin';
const OUVERT_URL = '/api/v1/essai/ouvert';
const PARTAGE_URL = '/api/v1/essai/partage';

/** Ce que le JETON affirme. Volontairement figé sur ADMIN. */
const TOKEN_USER: AuthenticatedUser = {
  id: 'user-1',
  email: 'ancien.admin@cpi.sn',
  username: 'ancien.admin',
  fullName: 'Ancien Admin',
  role: Role.ADMIN,
};

interface UserRow {
  role: Role;
  isActive: boolean;
  isDemo: boolean;
  deletedAt: Date | null;
}

class FakeUsers {
  row: UserRow | null = { role: Role.ADMIN, isActive: true, isDemo: false, deletedAt: null };

  readonly user = {
    findUnique: (): Promise<UserRow | null> => Promise.resolve(this.row),
  };

  asService(): PrismaService {
    return this as unknown as PrismaService;
  }
}

class FakeDemoVisibility {
  current: 'on' | 'off' | 'unknown' = 'off';

  state(): Promise<'on' | 'off' | 'unknown'> {
    return Promise.resolve(this.current);
  }

  asService(): DemoVisibilityService {
    return this as unknown as DemoVisibilityService;
  }
}

@Controller({ path: 'essai', version: '1' })
class EssaiController {
  /** Route ADMIN témoin, exactement comme celles de l'export intégral. */
  @Get('admin')
  @Roles(Role.ADMIN)
  admin(@CurrentUser() user: AuthenticatedUser): { role: string } {
    return { role: user.role };
  }

  /**
   * Route SANS rôle exigé, et c'est TOUT SON INTÉRÊT : elle représente
   * `sync/push`, `prospects/reassign`, l'export des représentants et les
   * listes, qui décident toutes d'après `request.user.role` dans leur service
   * sans porter le moindre décorateur.
   */
  @Get('ouvert')
  ouvert(@CurrentUser() user: AuthenticatedUser): { role: string } {
    return { role: user.role };
  }

  /** Route ouverte aux deux rôles : elle exige un rôle, donc elle le relit. */
  @Get('partage')
  @Roles(Role.ADMIN, Role.COMMERCIAL)
  partage(@CurrentUser() user: AuthenticatedUser): { role: string } {
    return { role: user.role };
  }
}

let app: NestFastifyApplication;
let users: FakeUsers;
let demo: FakeDemoVisibility;

beforeEach(async () => {
  users = new FakeUsers();
  demo = new FakeDemoVisibility();

  @Global()
  @Module({
    providers: [
      { provide: PrismaService, useValue: users.asService() },
      { provide: DemoVisibilityService, useValue: demo.asService() },
    ],
    exports: [PrismaService, DemoVisibilityService],
  })
  class FakePrismaModule {}

  const moduleRef = await Test.createTestingModule({
    imports: [FakePrismaModule],
    controllers: [EssaiController],
    providers: [
      // L'ORDRE de `app.module.ts` : la relecture d'autorité AVANT l'arbitrage
      // des rôles. Inversé, `RolesGuard` trancherait encore sur le jeton.
      { provide: APP_GUARD, useClass: FreshSessionGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
    ],
  }).compile();

  app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1', prefix: 'v' });

  // Le montage n'embarque pas `JwtAuthGuard` : on injecte directement l'identité
  // qu'un jeton ADMIN valide aurait produite, ce qui est précisément le point de
  // départ de chaque scénario.
  const instance: FastifyInstance = app.getHttpAdapter().getInstance();
  instance.addHook(
    'onRequest',
    (request: FastifyRequest, _reply: FastifyReply, done: () => void) => {
      (request as FastifyRequest & { user?: AuthenticatedUser }).user = { ...TOKEN_USER };
      done();
    },
  );

  await app.init();
  await instance.ready();
});

afterEach(async () => {
  await app.close();
});

describe('rôle rétrogradé pendant la vie du jeton', () => {
  /**
   * LE test. Le jeton dit ADMIN, la base dit COMMERCIAL, la route exige ADMIN.
   * Avant, la route répondait 200.
   */
  it('refuse la route ADMIN dès que la base a rétrogradé le compte', async () => {
    users.row = { role: Role.COMMERCIAL, isActive: true, isDemo: false, deletedAt: null };

    const response = await app.inject({ method: 'GET', url: ADMIN_URL });

    expect(response.statusCode).toBe(403);
  });

  /**
   * La session n'est PAS coupée, et le rôle CORRIGÉ circule en aval.
   *
   * Refuser sec sur « le rôle a changé » aurait déconnecté l'ancien
   * administrateur d'une route à laquelle il a parfaitement droit. Ici il
   * travaille, mais avec l'autorité qui est désormais la sienne : c'est cette
   * valeur-là que lit ensuite le cloisonnement de la couche service.
   */
  it('remplace le rôle du jeton par celui de la base sur une route à deux rôles', async () => {
    users.row = { role: Role.COMMERCIAL, isActive: true, isDemo: false, deletedAt: null };

    const response = await app.inject({ method: 'GET', url: PARTAGE_URL });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ role: string }>().role).toBe(Role.COMMERCIAL);
  });

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * LE TEST QUI FERME LA PORTE DE DERRIÈRE
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Ce test affirmait l'INVERSE, et il encodait un trou d'autorisation comme
   * une décision : une route sans `@Roles` gardait le rôle du JETON, au motif
   * qu'aucune de ces routes ne déciderait d'après le rôle.
   *
   * Elles le font, et pas qu'un peu. `isAdmin(request.user)` est lu à
   * l'INTÉRIEUR des services, sur des routes sans décorateur : `sync/push`
   * (où un ADMIN modifie et supprime des lignes dont il n'est pas l'auteur),
   * `prospects/reassign`, l'export des représentants, les listes prospects et
   * représentants, et tout `analytics`. Un ADMIN rétrogradé conservait donc son
   * autorité sur ces chemins pendant toute la vie de son jeton.
   *
   * La route témoin ci-dessous ne porte AUCUN `@Roles` : elle représente
   * exactement cette famille. Remettre une condition sur `@Roles` dans la garde
   * fait repasser ce test au rouge, ce qui est tout son objet.
   */
  it('relit l’autorité sur une route qui n’exige AUCUN rôle', async () => {
    users.row = { role: Role.COMMERCIAL, isActive: true, isDemo: false, deletedAt: null };

    const response = await app.inject({ method: 'GET', url: OUVERT_URL });

    // La session n'est pas coupée : la personne travaille, avec l'autorité qui
    // est désormais la sienne. C'est cette valeur-là que lisent ensuite
    // `isAdmin()` et `ownerScope()` dans la couche service.
    expect(response.statusCode).toBe(200);
    expect(response.json<{ role: string }>().role).toBe(Role.COMMERCIAL);
  });

  /**
   * Les trois refus immédiats valent AUSSI sans `@Roles`, et c'est la moitié
   * la plus importante : un compte supprimé, désactivé, ou de démonstration
   * après extinction du mode, atteignait `sync/push` sans être inquiété.
   */
  it('refuse un compte désactivé sur une route sans rôle exigé', async () => {
    users.row = { role: Role.COMMERCIAL, isActive: false, isDemo: false, deletedAt: null };

    expect((await app.inject({ method: 'GET', url: OUVERT_URL })).statusCode).toBe(401);
  });

  it('refuse un jeton de démonstration sur une route sans rôle exigé', async () => {
    users.row = { role: Role.COMMERCIAL, isActive: true, isDemo: true, deletedAt: null };
    demo.current = 'off';

    expect((await app.inject({ method: 'GET', url: OUVERT_URL })).statusCode).toBe(401);
  });

  /**
   * Contre-épreuve, indispensable : une garde qui refuserait TOUT ferait passer
   * le premier test sans rien prouver, et fermerait le panel à tous les
   * administrateurs légitimes.
   */
  it('laisse passer un administrateur qui l’est toujours', async () => {
    const response = await app.inject({ method: 'GET', url: ADMIN_URL });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ role: string }>().role).toBe(Role.ADMIN);
  });
});

describe('compte qui n’a plus de session légitime', () => {
  it('refuse un compte désactivé, sans attendre l’expiration du jeton', async () => {
    users.row = { role: Role.ADMIN, isActive: false, isDemo: false, deletedAt: null };

    expect((await app.inject({ method: 'GET', url: ADMIN_URL })).statusCode).toBe(401);
  });

  it('refuse un compte supprimé', async () => {
    users.row = null;

    expect((await app.inject({ method: 'GET', url: ADMIN_URL })).statusCode).toBe(401);
  });
});

describe('session de démonstration après extinction du mode', () => {
  /**
   * LE second test qui compte. Le compte de démonstration est semé ADMIN, avec
   * un mot de passe publié dans ce dépôt. La correction précédente refuse de
   * lui ÉMETTRE une session hors démonstration ; celle-ci coupe les jetons
   * DÉJÀ émis, qui sont ceux qu'un visiteur a pu emporter pendant la séance.
   */
  it('refuse un jeton de démonstration une fois l’interrupteur éteint', async () => {
    users.row = { role: Role.ADMIN, isActive: true, isDemo: true, deletedAt: null };
    demo.current = 'off';

    const response = await app.inject({ method: 'GET', url: ADMIN_URL });

    expect(response.statusCode).toBe(401);
  });

  /**
   * Le doute REFUSE, comme à l'émission. Refuser à tort coûte une reconnexion ;
   * accepter à tort laisse une session ADMIN de démonstration sur les données
   * réelles, avec un mot de passe public.
   */
  it('refuse aussi quand l’état de la démonstration est indéterminé', async () => {
    users.row = { role: Role.ADMIN, isActive: true, isDemo: true, deletedAt: null };
    demo.current = 'unknown';

    expect((await app.inject({ method: 'GET', url: ADMIN_URL })).statusCode).toBe(401);
  });

  it('laisse travailler le compte de démonstration pendant la démonstration', async () => {
    users.row = { role: Role.ADMIN, isActive: true, isDemo: true, deletedAt: null };
    demo.current = 'on';

    expect((await app.inject({ method: 'GET', url: ADMIN_URL })).statusCode).toBe(200);
  });
});
