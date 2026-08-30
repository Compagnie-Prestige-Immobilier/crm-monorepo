import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyRequest } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppUpdatesService } from './app-updates.service.js';
import {
  AUTRE_SIGNER,
  createAppUpdatesApp,
  FAKE_ADMIN,
  FakeReleaseStore,
  FIXTURE_SIGNER,
} from './fake-release-store.js';
import type { AndroidReleaseDto, AndroidReleaseListDto, AppUpdateDto } from './dto.js';

const BASE = '/api/v1/app-updates/android';

let app: NestFastifyApplication;
let store: FakeReleaseStore;
let releaseDir: string;

beforeAll(async () => {
  process.env.NODE_ENV ??= 'test';
  process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
  process.env.JWT_ACCESS_SECRET ??= 'app-updates-access-secret-32-characters';
  process.env.JWT_REFRESH_SECRET ??= 'app-updates-refresh-secret-32-characters';
  releaseDir = await mkdtemp(join(tmpdir(), 'cpi-lifecycle-'));
  process.env.APK_RELEASE_DIR = releaseDir;

  store = new FakeReleaseStore();
  app = await createAppUpdatesApp(store);
});

afterAll(async () => {
  await app.close();
});

const seed = async (
  ...releases: { versionCode: number; mandatory?: boolean; withdrawnAt?: Date }[]
): Promise<void> => {
  store.seed(...releases);
  for (const release of releases) {
    await writeFile(join(releaseDir, `cpi-go-${String(release.versionCode)}.apk`), 'apk');
  }
};

const current = async (versionCode: number): Promise<AppUpdateDto> =>
  (
    await app.inject({ method: 'GET', url: `${BASE}/current?versionCode=${String(versionCode)}` })
  ).json<AppUpdateDto>();

const post = (path: string) => app.inject({ method: 'POST', url: `${BASE}/${path}` });

beforeEach(async () => {
  for (const entry of await readdir(releaseDir)) {
    await writeFile(join(releaseDir, entry), 'apk');
  }
});

describe('plancher obligatoire, dérivé', () => {
  it('reste null tant qu’aucune release n’est obligatoire', async () => {
    await seed({ versionCode: 12 }, { versionCode: 7 });

    const body = await current(1);

    expect(body.minVersionCode).toBeNull();
    expect(body.available).toBe(true);
    expect(body.forceUpdate).toBe(false);
  });

  it('vaut la PLUS HAUTE release obligatoire en ligne', async () => {
    await seed(
      { versionCode: 12 },
      { versionCode: 9, mandatory: true },
      { versionCode: 5, mandatory: true },
    );

    expect((await current(1)).minVersionCode).toBe(9);
  });

  it('force la mise à jour sous le plancher, et la laisse facultative au-dessus', async () => {
    await seed({ versionCode: 12 }, { versionCode: 9, mandatory: true });

    expect((await current(8)).forceUpdate).toBe(true);
    expect((await current(9)).forceUpdate).toBe(false);
    expect((await current(10)).forceUpdate).toBe(false);
  });

  it('REDESCEND quand la release obligatoire est retirée', async () => {
    await seed(
      { versionCode: 12 },
      { versionCode: 9, mandatory: true },
      { versionCode: 5, mandatory: true },
    );

    expect((await post('9/withdraw')).statusCode).toBe(201);

    expect((await current(1)).minVersionCode).toBe(5);
  });

  it('ne sort pas de plancher d’une release obligatoire déjà retirée', async () => {
    await seed({ versionCode: 12 }, { versionCode: 9, mandatory: true, withdrawnAt: new Date() });

    expect((await current(1)).minVersionCode).toBeNull();
  });
});

describe('POST android/{versionCode}/mandatory', () => {
  it('pose le plancher et le rend visible aux postes', async () => {
    await seed({ versionCode: 12 }, { versionCode: 7 });

    const response = await post('12/mandatory');

    expect(response.statusCode).toBe(201);
    expect(response.json<AndroidReleaseDto>().mandatory).toBe(true);
    expect((await current(7)).minVersionCode).toBe(12);
  });

  it('est idempotent', async () => {
    await seed({ versionCode: 12 });

    await post('12/mandatory');
    const second = await post('12/mandatory');

    expect(second.statusCode).toBe(201);
    expect(second.json<AndroidReleaseDto>().mandatory).toBe(true);
  });

  it('refuse une version inconnue', async () => {
    await seed({ versionCode: 12 });

    const response = await post('99/mandatory');

    expect(response.statusCode).toBe(404);
    expect(response.json<{ code: string }>().code).toBe('APK_RELEASE_UNKNOWN');
  });

  it('refuse une version retirée', async () => {
    await seed({ versionCode: 12 }, { versionCode: 7, withdrawnAt: new Date() });

    expect((await post('7/mandatory')).statusCode).toBe(404);
  });
});

describe('POST android/{versionCode}/withdraw', () => {
  it('supprime le fichier et cesse de servir la version', async () => {
    await seed({ versionCode: 12 }, { versionCode: 7 });

    const response = await post('12/withdraw');

    expect(response.statusCode).toBe(201);
    expect(response.json<AndroidReleaseDto>().withdrawnById).toBe(FAKE_ADMIN.id);
    expect(await readdir(releaseDir)).not.toContain('cpi-go-12.apk');

    const download = await app.inject({ method: 'GET', url: `${BASE}/download?v=12` });
    expect(download.statusCode).toBe(404);
    expect(download.json<{ code: string }>().code).toBe('APK_VERSION_WITHDRAWN');
  });

  it('fait redescendre la release courante sur la précédente', async () => {
    await seed({ versionCode: 12 }, { versionCode: 7 });

    await post('12/withdraw');

    expect((await current(1)).versionCode).toBe(7);
  });

  it('REFUSE de retirer la seule release en ligne', async () => {
    await seed({ versionCode: 12 }, { versionCode: 7, withdrawnAt: new Date() });

    const response = await post('12/withdraw');

    expect(response.statusCode).toBe(409);
    expect(response.json<{ code: string }>().code).toBe('APK_LAST_RELEASE');
    expect(await readdir(releaseDir)).toContain('cpi-go-12.apk');
  });

  it('est idempotent sur une release déjà retirée', async () => {
    await seed({ versionCode: 12 }, { versionCode: 7 });

    await post('7/withdraw');
    const second = await post('7/withdraw');

    expect(second.statusCode).toBe(201);
    expect(second.json<AndroidReleaseDto>().withdrawnAt).not.toBeNull();
  });

  it('refuse une version inconnue', async () => {
    await seed({ versionCode: 12 });

    expect((await post('99/withdraw')).statusCode).toBe(404);
  });
});

describe('GET android/releases', () => {
  it('rend l’historique du plus récent au plus ancien, retirées comprises', async () => {
    await seed({ versionCode: 7 }, { versionCode: 12, mandatory: true }, { versionCode: 5 });

    const body = (
      await app.inject({ method: 'GET', url: `${BASE}/releases` })
    ).json<AndroidReleaseListDto>();

    expect(body.items.map((item) => item.versionCode)).toEqual([12, 7, 5]);
    expect(body.minVersionCode).toBe(12);
    expect(body.items[0]?.publishedByName).toBe(FAKE_ADMIN.fullName);
  });
});

describe('empreinte de référence', () => {
  it('APK_SIGNER_SHA256 prime sur la dernière release publiée', async () => {
    const isolated = new FakeReleaseStore();
    isolated.seed({ versionCode: 1, signerSha256: FIXTURE_SIGNER });
    process.env.APK_SIGNER_SHA256 = AUTRE_SIGNER;

    const apk = await readFile(fileURLToPath(new URL('./fixtures/cpi-go-v7.apk', import.meta.url)));
    const request = {
      parts: async function* () {
        yield {
          type: 'file',
          fieldname: 'file',
          filename: 'cpi-go.apk',
          file: Readable.from([apk]),
          fields: {},
        };
      },
    };

    try {
      await expect(
        new AppUpdatesService(isolated.asService()).upload(
          request as unknown as FastifyRequest,
          FAKE_ADMIN,
        ),
      ).rejects.toThrow(AUTRE_SIGNER);
    } finally {
      delete process.env.APK_SIGNER_SHA256;
    }
  });
});
