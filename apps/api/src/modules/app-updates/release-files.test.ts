import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import type * as NodeFs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import type { FastifyRequest } from 'fastify';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { AppUpdatesService } from './app-updates.service.js';
import { FAKE_ADMIN, FakeReleaseStore } from './fake-release-store.js';

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
  }
}

let releaseDir: string;
let store: FakeReleaseStore;
let cpiGoV12: Buffer;

const publish = (): Promise<{ fileName: string }> =>
  new AppUpdatesService(store.asService()).upload(
    new ApkRequest(cpiGoV12) as unknown as FastifyRequest,
    FAKE_ADMIN,
  );

const apks = async (): Promise<string[]> =>
  (await readdir(releaseDir)).filter((name) => name.endsWith('.apk')).sort();

beforeAll(async () => {
  process.env.NODE_ENV ??= 'test';
  process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
  process.env.JWT_ACCESS_SECRET ??= 'app-updates-access-secret-32-characters';
  process.env.JWT_REFRESH_SECRET ??= 'app-updates-refresh-secret-32-characters';
  cpiGoV12 = await readFile(fileURLToPath(new URL('./fixtures/cpi-go-v12.apk', import.meta.url)));
});

beforeEach(async () => {
  releaseDir = await mkdtemp(join(tmpdir(), 'cpi-releases-'));
  process.env.APK_RELEASE_DIR = releaseDir;
  store = new FakeReleaseStore();
  failures.rename = false;
});

const seedOnDisk = async (
  ...releases: { versionCode: number; fileName: string; withdrawnAt?: Date }[]
): Promise<void> => {
  for (const release of releases) await writeFile(join(releaseDir, release.fileName), 'ancien');
  store.seed(...releases);
};

describe('fichiers de release', () => {
  it('garde les TROIS dernières releases en ligne et supprime la quatrième', async () => {
    await seedOnDisk(
      { versionCode: 3, fileName: 'cpi-go-3.apk' },
      { versionCode: 5, fileName: 'cpi-go-5.apk' },
      { versionCode: 7, fileName: 'cpi-go-7.apk' },
    );

    const published = await publish();

    expect(await apks()).toEqual(
      ['cpi-go-5.apk', 'cpi-go-7.apk', published.fileName].sort((a, b) => a.localeCompare(b)),
    );
  });

  it('ne compte pas une release RETIRÉE parmi les trois gardées', async () => {
    await seedOnDisk(
      { versionCode: 3, fileName: 'cpi-go-3.apk' },
      { versionCode: 5, fileName: 'cpi-go-5.apk', withdrawnAt: new Date() },
      { versionCode: 7, fileName: 'cpi-go-7.apk' },
    );

    const published = await publish();

    expect(await apks()).toEqual(
      ['cpi-go-3.apk', 'cpi-go-7.apk', published.fileName].sort((a, b) => a.localeCompare(b)),
    );
  });

  it('un renommage qui échoue laisse la release précédente intacte et rien d’autre', async () => {
    await seedOnDisk({ versionCode: 1, fileName: 'cpi-go-1-precedent.apk' });
    failures.rename = true;

    await expect(publish()).rejects.toThrow('disque plein');

    expect(await readdir(releaseDir)).toEqual(['cpi-go-1-precedent.apk']);
    expect(store.stored().map((release) => release.versionCode)).toEqual([1]);
  });

  it('rattrape l’APK d’un envoi coupé avant sa ligne', async () => {
    store.failNextWrite = true;
    await expect(publish()).rejects.toThrow('base indisponible');

    // Le fichier survit à la coupure ; plus aucune ligne ne le nomme.
    expect(await apks()).toHaveLength(1);

    const published = await publish();

    expect(await apks()).toEqual([published.fileName]);
  });
});
