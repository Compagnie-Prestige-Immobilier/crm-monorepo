import { Global, Module, VersioningType } from '@nestjs/common';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Test } from '@nestjs/testing';
import multipart from '@fastify/multipart';
import { Role } from '@crm/database';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { AppUpdatesModule } from './app-updates.module.js';
import type { ReleaseRow } from './app-updates.service.js';

/** Empreinte du certificat qui signe les APK de `fixtures/`. */
export const FIXTURE_SIGNER = '9434b1f9594e7f5d20bda74d047e40affdc8003f51d89421d4b79456ad7f3909';

export const AUTRE_SIGNER = '3a22ee16b507e5271312b4365f9b35c9c61cd5a831b453130cefdc22459928a6';

export const FAKE_ADMIN: AuthenticatedUser = {
  id: 'adm-1',
  email: 'admin@cpi.sn',
  username: 'admin',
  fullName: 'Admin CPI',
  role: Role.ADMIN,
};

type Mutable = { -readonly [K in keyof ReleaseRow]: ReleaseRow[K] };

const row = (release: Partial<ReleaseRow> & { versionCode: number }): Mutable => ({
  versionName: `1.0.${String(release.versionCode)}`,
  fileName: `cpi-go-${String(release.versionCode)}.apk`,
  fileSize: 10,
  sha256: 'x'.repeat(64),
  signerSha256: FIXTURE_SIGNER,
  mandatory: false,
  publishedAt: new Date('2026-01-01T00:00:00.000Z'),
  publishedById: FAKE_ADMIN.id,
  publishedBy: { fullName: FAKE_ADMIN.fullName },
  notes: null,
  withdrawnAt: null,
  withdrawnById: null,
  ...release,
});

export class FakeReleaseStore {
  private rows: Mutable[] = [];
  failNextWrite = false;

  readonly androidRelease = {
    findMany: (): Promise<ReleaseRow[]> =>
      Promise.resolve([...this.rows].sort((a, b) => b.versionCode - a.versionCode)),

    create: ({ data }: { data: Partial<ReleaseRow> & { versionCode: number } }) => {
      if (this.failNextWrite) {
        this.failNextWrite = false;
        return Promise.reject(new Error('base indisponible'));
      }
      const created = row(data);
      this.rows.push(created);
      return Promise.resolve(created as ReleaseRow);
    },

    update: ({
      where,
      data,
    }: {
      where: { versionCode: number };
      data: Partial<ReleaseRow>;
    }): Promise<ReleaseRow> => {
      const found = this.rows.find((candidate) => candidate.versionCode === where.versionCode);
      if (!found) return Promise.reject(new Error('release absente'));
      Object.assign(found, data);
      return Promise.resolve(found as ReleaseRow);
    },
  };

  seed(...releases: (Partial<ReleaseRow> & { versionCode: number })[]): void {
    this.rows = releases.map(row);
  }

  stored(): ReleaseRow[] {
    return this.rows as ReleaseRow[];
  }

  asService(): PrismaService {
    return this as unknown as PrismaService;
  }
}

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
