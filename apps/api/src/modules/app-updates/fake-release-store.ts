import { Global, Module, VersioningType } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import multipart from '@fastify/multipart';
import { Role } from '@crm/database';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AppUpdatesModule } from './app-updates.module.js';

const SETTING_KEY = 'mobile.android.release';

export class FakeReleaseStore {
  private value: string | null = null;

  readonly appSetting = {
    findUnique: ({ where }: { where: { key: string } }): Promise<{ value: string } | null> =>
      Promise.resolve(
        where.key === SETTING_KEY && this.value !== null ? { value: this.value } : null,
      ),
    upsert: ({ create }: { create: { value: string } }): Promise<{ value: string }> => {
      this.value = create.value;
      return Promise.resolve({ value: create.value });
    },
  };

  seed(release: Record<string, unknown>): void {
    this.value = JSON.stringify(release);
  }

  stored(): string | null {
    return this.value;
  }

  asService(): PrismaService {
    return this as unknown as PrismaService;
  }
}

export const FAKE_ADMIN: AuthenticatedUser = {
  id: 'adm-1',
  email: 'admin@cpi.sn',
  username: 'admin',
  fullName: 'Admin CPI',
  role: Role.ADMIN,
};

export async function createAppUpdatesApp(
  store: FakeReleaseStore,
): Promise<NestFastifyApplication> {
  @Global()
  @Module({
    providers: [{ provide: PrismaService, useValue: store.asService() }],
    exports: [PrismaService],
  })
  class FakePrismaModule {}

  const moduleRef = await Test.createTestingModule({
    imports: [FakePrismaModule, AppUpdatesModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1', prefix: 'v' });
  await app.register(multipart, { limits: { fileSize: 10_000_000, files: 1, fields: 8 } });

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

export function multipartBody(
  fields: Record<string, string>,
  file: { name: string; content: Buffer },
  trailingFields: Record<string, string> = {},
): { payload: Buffer; headers: Record<string, string> } {
  const boundary = '----cpitest0123456789';
  const fieldPart = (key: string, value: string): Buffer =>
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`,
    );

  const parts: Buffer[] = [];
  for (const [key, value] of Object.entries(fields)) parts.push(fieldPart(key, value));
  parts.push(
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\n` +
        'Content-Type: application/vnd.android.package-archive\r\n\r\n',
    ),
    file.content,
    Buffer.from('\r\n'),
  );
  for (const [key, value] of Object.entries(trailingFields)) parts.push(fieldPart(key, value));
  parts.push(Buffer.from(`--${boundary}--\r\n`));

  return {
    payload: Buffer.concat(parts),
    headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
  };
}
