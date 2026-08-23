import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import type * as NodeFs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import type { FastifyRequest } from 'fastify';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PrismaService } from '../../prisma/prisma.service.js';
import { AppUpdatesService } from './app-updates.service.js';
import { FAKE_ADMIN } from './fake-release-store.js';

const failures = vi.hoisted(() => ({ rename: false }));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof NodeFs>();
  return {
    ...actual,
    rename: (from: string, to: string): Promise<void> => {
      if (failures.rename) return Promise.reject(new Error('disque plein'));
      return actual.rename(from, to);
    },
  };
});

const SETTING_KEY = 'mobile.android.release';

class Store {
  value: string | null = null;
  failNextUpsert = false;

  readonly appSetting = {
    findUnique: ({ where }: { where: { key: string } }): Promise<{ value: string } | null> =>
      Promise.resolve(
        where.key === SETTING_KEY && this.value !== null ? { value: this.value } : null,
      ),
    upsert: ({ create }: { create: { value: string } }): Promise<{ value: string }> => {
      if (this.failNextUpsert) {
        this.failNextUpsert = false;
        return Promise.reject(new Error('base indisponible'));
      }
      this.value = create.value;
      return Promise.resolve({ value: create.value });
    },
  };

  seed(fileName: string): void {
    this.value = JSON.stringify({
      versionName: '1.0.0',
      versionCode: 1,
      forceUpdate: false,
      fileName,
      fileSize: 6,
      sha256: 'x'.repeat(64),
      publishedAt: '2026-01-01T00:00:00.000Z',
      notes: null,
    });
  }

  asService(): PrismaService {
    return this as unknown as PrismaService;
  }
}

class ApkRequest {
  constructor(private readonly apk: Buffer) {}

  async *parts(): AsyncGenerator {
    await Promise.resolve();
    yield {
      type: 'file',
      fieldname: 'file',
      filename: 'cpi-go.apk',
      file: Readable.from([this.apk]),
      fields: {},
    };
    yield { type: 'field', fieldname: 'forceUpdate', value: 'false', fields: {} };
  }
}

let releaseDir: string;
let store: Store;
let cpiGoV7: Buffer;

const publish = (): Promise<{ fileName: string }> =>
  new AppUpdatesService(store.asService()).upload(
    new ApkRequest(cpiGoV7) as unknown as FastifyRequest,
    FAKE_ADMIN,
  );

const apks = async (): Promise<string[]> =>
  (await readdir(releaseDir)).filter((name) => name.endsWith('.apk'));

beforeAll(async () => {
  process.env.NODE_ENV ??= 'test';
  process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
  process.env.JWT_ACCESS_SECRET ??= 'app-updates-access-secret-32-characters';
  process.env.JWT_REFRESH_SECRET ??= 'app-updates-refresh-secret-32-characters';
  cpiGoV7 = await readFile(fileURLToPath(new URL('./fixtures/cpi-go-v7.apk', import.meta.url)));
});

beforeEach(async () => {
  releaseDir = await mkdtemp(join(tmpdir(), 'cpi-releases-'));
  process.env.APK_RELEASE_DIR = releaseDir;
  store = new Store();
  failures.rename = false;
});

describe('fichiers de release', () => {
  it('supprime l’APK remplacé une fois la publication acquise', async () => {
    await writeFile(join(releaseDir, 'cpi-go-1-precedent.apk'), 'ancien');
    store.seed('cpi-go-1-precedent.apk');

    const published = await publish();

    expect(await apks()).toEqual([published.fileName]);
  });

  it('un renommage qui échoue laisse la release précédente intacte et rien d’autre', async () => {
    await writeFile(join(releaseDir, 'cpi-go-1-precedent.apk'), 'ancien');
    store.seed('cpi-go-1-precedent.apk');
    failures.rename = true;

    await expect(publish()).rejects.toThrow('disque plein');

    expect(await readdir(releaseDir)).toEqual(['cpi-go-1-precedent.apk']);
    expect(store.value).toContain('"versionCode":1');
  });

  it('rattrape l’APK d’un envoi coupé avant sa ligne', async () => {
    store.seed('cpi-go-1-precedent.apk');
    store.failNextUpsert = true;
    await expect(publish()).rejects.toThrow('base indisponible');

    // Le fichier survit à la coupure ; plus aucune ligne ne le nomme.
    expect(await apks()).toHaveLength(1);

    const published = await publish();

    expect(await apks()).toEqual([published.fileName]);
  });
});
