import { createWriteStream } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { Global, Module, VersioningType } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import { Role } from '@crm/database';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { createGzip } from 'node:zlib';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { fakeWorkspace } from '../../workspaces/fake-workspace.js';
import { LiveService } from '../live/live.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { DbDumpController } from './db-dump.controller.js';
import { DbDumpService } from './db-dump.service.js';
import { DUMP_RUNNER, type DumpRunner } from './db-dump.runner.js';

const SETTING_KEY = 'admin.database.dump';

export interface AuditRow {
  userId: string | null;
  action: string;
  entity: string;
  entityId: string;
  after: unknown;
}

export class FakeDumpStore {
  private value: string | null = null;
  readonly audits: AuditRow[] = [];

  onBeforeConditionalWrite: (() => Promise<void>) | null = null;

  readonly appSetting = {
    findUnique: ({ where }: { where: { key: string } }): Promise<{ value: string } | null> =>
      Promise.resolve(
        where.key === SETTING_KEY && this.value !== null ? { value: this.value } : null,
      ),

    create: ({ data }: { data: { key: string; value: string } }): Promise<{ value: string }> => {
      if (this.value !== null) {
        return Promise.reject(new Error('Unique constraint failed on the fields: (`key`)'));
      }
      this.value = data.value;
      return Promise.resolve({ value: data.value });
    },

    updateMany: async ({
      where,
      data,
    }: {
      where: { key: string; value?: string | { contains: string } };
      data: { value: string };
    }): Promise<{ count: number }> => {
      const hook = this.onBeforeConditionalWrite;
      if (hook !== null) {
        this.onBeforeConditionalWrite = null;
        await hook();
      }
      if (where.key !== SETTING_KEY || this.value === null) return { count: 0 };

      const expected = where.value;
      if (typeof expected === 'string' && this.value !== expected) return { count: 0 };
      if (
        expected !== undefined &&
        typeof expected === 'object' &&
        !this.value.includes(expected.contains)
      ) {
        return { count: 0 };
      }

      this.value = data.value;
      return { count: 1 };
    },

    upsert: ({ create }: { create: { value: string } }): Promise<{ value: string }> => {
      this.value = create.value;
      return Promise.resolve({ value: create.value });
    },
  };

  readonly auditLog = {
    create: ({ data }: { data: AuditRow }): Promise<AuditRow> => {
      this.audits.push(data);
      return Promise.resolve(data);
    },
  };

  seed(job: Record<string, unknown>): void {
    this.value = JSON.stringify(job);
  }

  stored(): Record<string, unknown> | null {
    return this.value === null ? null : (JSON.parse(this.value) as Record<string, unknown>);
  }

  asService(): PrismaService {
    return this as unknown as PrismaService;
  }
}

export class FakeDumpRunner implements DumpRunner {
  calls = 0;
  failWith: string | null = null;
  private gate: Promise<void> | null = null;
  private open: (() => void) | null = null;
  private partial = false;

  hold(): void {
    this.gate = new Promise<void>((resolve) => {
      this.open = resolve;
    });
  }

  holdWithOutput(): void {
    this.partial = true;
    this.hold();
  }

  release(): void {
    this.open?.();
    this.gate = null;
    this.open = null;
    this.partial = false;
  }

  async run(destination: string): Promise<void> {
    this.calls += 1;
    if (this.gate !== null) {
      if (this.partial) await writeFile(destination, '-- export partiel, en cours d’écriture\n');
      await this.gate;
    }
    if (this.failWith !== null) throw new Error(this.failWith);
    await pipeline(
      Readable.from(['-- export CPI GO\nCREATE TABLE prospects (id uuid);\n']),
      createGzip(),
      createWriteStream(destination),
    );
  }
}

export class FakeNotifications {
  readonly sent: {
    title: string;
    body: string;
    route?: string;
    audienceUserIds?: string[];
  }[] = [];
  transportStatus: string | null = 'SENT';
  throwWith: string | null = null;

  create(
    _user: AuthenticatedUser,
    body: { title: string; body: string; route?: string; audienceUserIds?: string[] },
  ): Promise<{ transportStatus: string | null }> {
    if (this.throwWith !== null) return Promise.reject(new Error(this.throwWith));
    this.sent.push(body);
    return Promise.resolve({ transportStatus: this.transportStatus });
  }

  asService(): NotificationsService {
    return this as unknown as NotificationsService;
  }
}

export const FAKE_ADMIN: AuthenticatedUser = {
  id: '0199a000-0000-7000-8000-000000000001',
  email: 'admin@cpi.sn',
  username: 'admin',
  fullName: 'Admin CPI',
  role: Role.ADMIN,
};

export interface DumpHarness {
  app: NestFastifyApplication;
  store: FakeDumpStore;
  runner: FakeDumpRunner;
  notifications: FakeNotifications;
}

export async function createDumpApp(harness: {
  store: FakeDumpStore;
  runner: FakeDumpRunner;
  notifications: FakeNotifications;
}): Promise<NestFastifyApplication> {
  @Global()
  @Module({
    providers: [{ provide: PrismaService, useValue: harness.store.asService() }],
    exports: [PrismaService],
  })
  class FakePrismaModule {}

  const moduleRef = await Test.createTestingModule({
    imports: [FakePrismaModule],
    controllers: [DbDumpController],
    providers: [
      DbDumpService,
      { provide: NotificationsService, useValue: harness.notifications.asService() },
      { provide: DUMP_RUNNER, useValue: harness.runner },
      { provide: LiveService, useValue: new LiveService(fakeWorkspace()) },
    ],
  }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
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
  return app;
}
