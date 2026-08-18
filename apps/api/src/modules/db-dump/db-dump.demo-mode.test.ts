import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Global, Module, VersioningType } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { DemoReadOnlyGuard } from '../../common/guards/demo-read-only.guard.js';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { DemoVisibilityService } from '../../prisma/demo-visibility.service.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { DbDumpController } from './db-dump.controller.js';
import { DbDumpService } from './db-dump.service.js';
import { DUMP_RUNNER } from './db-dump.runner.js';
import { FAKE_ADMIN, FakeDumpRunner, FakeDumpStore, FakeNotifications } from './fake-dump-store.js';

const STATE_URL = '/api/v1/admin/database-dump';
const DOWNLOAD_URL = '/api/v1/admin/database-dump/download';

class FakeDemoVisibility {
  current: 'on' | 'off' | 'unknown' = 'off';

  state(): Promise<'on' | 'off' | 'unknown'> {
    return Promise.resolve(this.current);
  }

  asService(): DemoVisibilityService {
    return this as unknown as DemoVisibilityService;
  }
}

let app: NestFastifyApplication;
let store: FakeDumpStore;
let runner: FakeDumpRunner;
let demo: FakeDemoVisibility;

beforeAll(() => {
  process.env.NODE_ENV ??= 'test';
  process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
  process.env.JWT_ACCESS_SECRET ??= 'db-dump-access-secret-32-characters-x';
  process.env.JWT_REFRESH_SECRET ??= 'db-dump-refresh-secret-32-characters-x';
});

beforeEach(async () => {
  process.env.DB_DUMP_DIR = await mkdtemp(join(tmpdir(), 'cpi-dumps-demo-'));
  process.env.DB_DUMP_ENABLED = 'true';
  store = new FakeDumpStore();
  runner = new FakeDumpRunner();
  demo = new FakeDemoVisibility();

  @Global()
  @Module({
    providers: [
      { provide: PrismaService, useValue: store.asService() },
      { provide: DemoVisibilityService, useValue: demo.asService() },
    ],
    exports: [PrismaService, DemoVisibilityService],
  })
  class FakePrismaModule {}

  const moduleRef = await Test.createTestingModule({
    imports: [FakePrismaModule],
    controllers: [DbDumpController],
    providers: [
      DbDumpService,
      { provide: NotificationsService, useValue: new FakeNotifications().asService() },
      { provide: DUMP_RUNNER, useValue: runner },
      { provide: APP_GUARD, useClass: DemoReadOnlyGuard },
    ],
  }).compile();

  app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1', prefix: 'v' });

  const instance: FastifyInstance = app.getHttpAdapter().getInstance();
  instance.addHook(
    'onRequest',
    (request: FastifyRequest, _reply: FastifyReply, done: () => void) => {
      (request as FastifyRequest & { user?: AuthenticatedUser }).user = FAKE_ADMIN;
      done();
    },
  );

  await app.init();
  await instance.ready();
});

afterEach(async () => {
  await app.close();
});

describe('export intégral et mode démonstration', () => {
  it('refuse la demande d’export tant que la démonstration est allumée', async () => {
    demo.current = 'on';

    const response = await app.inject({ method: 'POST', url: STATE_URL });

    expect(response.statusCode).toBe(409);
    expect(response.json<{ code: string }>().code).toBe('DEMO_MODE_READ_ONLY');
    expect(runner.calls).toBe(0);
    expect(store.stored()).toBeNull();
  });

  it('refuse également quand l’état de la démonstration est indéterminé', async () => {
    demo.current = 'unknown';

    expect((await app.inject({ method: 'POST', url: STATE_URL })).statusCode).toBe(409);
    expect(runner.calls).toBe(0);
  });

  it('accepte la demande quand la démonstration est éteinte', async () => {
    demo.current = 'off';

    expect((await app.inject({ method: 'POST', url: STATE_URL })).statusCode).toBe(202);
  });

  it('laisse consulter l’état et télécharger pendant une démonstration', async () => {
    await app.inject({ method: 'POST', url: STATE_URL });
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const body = (await app.inject({ method: 'GET', url: STATE_URL })).json<{ status: string }>();
      if (body.status === 'ready') break;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    demo.current = 'on';

    expect((await app.inject({ method: 'GET', url: STATE_URL })).statusCode).toBe(200);
    expect((await app.inject({ method: 'GET', url: DOWNLOAD_URL })).statusCode).toBe(200);
  });
});
