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

const ADMIN_URL = '/api/v1/essai/admin';
const OUVERT_URL = '/api/v1/essai/ouvert';
const PARTAGE_URL = '/api/v1/essai/partage';

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
  @Get('admin')
  @Roles(Role.ADMIN)
  admin(@CurrentUser() user: AuthenticatedUser): { role: string } {
    return { role: user.role };
  }

  @Get('ouvert')
  ouvert(@CurrentUser() user: AuthenticatedUser): { role: string } {
    return { role: user.role };
  }

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
      { provide: APP_GUARD, useClass: FreshSessionGuard },
      { provide: APP_GUARD, useClass: RolesGuard },
    ],
  }).compile();

  app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1', prefix: 'v' });

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
  it('refuse la route ADMIN dès que la base a rétrogradé le compte', async () => {
    users.row = { role: Role.COMMERCIAL, isActive: true, isDemo: false, deletedAt: null };

    const response = await app.inject({ method: 'GET', url: ADMIN_URL });

    expect(response.statusCode).toBe(403);
  });

  it('remplace le rôle du jeton par celui de la base sur une route à deux rôles', async () => {
    users.row = { role: Role.COMMERCIAL, isActive: true, isDemo: false, deletedAt: null };

    const response = await app.inject({ method: 'GET', url: PARTAGE_URL });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ role: string }>().role).toBe(Role.COMMERCIAL);
  });

  it('relit l’autorité sur une route qui n’exige AUCUN rôle', async () => {
    users.row = { role: Role.COMMERCIAL, isActive: true, isDemo: false, deletedAt: null };

    const response = await app.inject({ method: 'GET', url: OUVERT_URL });

    expect(response.statusCode).toBe(200);
    expect(response.json<{ role: string }>().role).toBe(Role.COMMERCIAL);
  });

  it('refuse un compte désactivé sur une route sans rôle exigé', async () => {
    users.row = { role: Role.COMMERCIAL, isActive: false, isDemo: false, deletedAt: null };

    expect((await app.inject({ method: 'GET', url: OUVERT_URL })).statusCode).toBe(401);
  });

  it('refuse un jeton de démonstration sur une route sans rôle exigé', async () => {
    users.row = { role: Role.COMMERCIAL, isActive: true, isDemo: true, deletedAt: null };
    demo.current = 'off';

    expect((await app.inject({ method: 'GET', url: OUVERT_URL })).statusCode).toBe(401);
  });

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
  it('refuse un jeton de démonstration une fois l’interrupteur éteint', async () => {
    users.row = { role: Role.ADMIN, isActive: true, isDemo: true, deletedAt: null };
    demo.current = 'off';

    const response = await app.inject({ method: 'GET', url: ADMIN_URL });

    expect(response.statusCode).toBe(401);
  });

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
