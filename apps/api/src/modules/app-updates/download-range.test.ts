import { createHash } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAppUpdatesApp, FakeReleaseStore } from './fake-release-store.js';

const DOWNLOAD_URL = '/api/v1/app-updates/android/download';

const CONTENT = Buffer.from(
  Array.from({ length: 2_000 }, (_, index) => (index * 7 + Math.floor(index / 251)) % 256),
);

let app: NestFastifyApplication;
const store = new FakeReleaseStore();

beforeAll(async () => {
  process.env.NODE_ENV ??= 'test';
  process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
  process.env.JWT_ACCESS_SECRET ??= 'app-updates-access-secret-32-characters';
  process.env.JWT_REFRESH_SECRET ??= 'app-updates-refresh-secret-32-characters';
  const directory = await mkdtemp(join(tmpdir(), 'cpi-releases-'));
  process.env.APK_RELEASE_DIR = directory;

  await writeFile(join(directory, 'cpi-go-42-test.apk'), CONTENT);
  store.seed({
    versionName: '1.4.0',
    versionCode: 42,
    forceUpdate: false,
    fileName: 'cpi-go-42-test.apk',
    fileSize: CONTENT.length,
    sha256: createHash('sha256').update(CONTENT).digest('hex'),
    publishedAt: '2026-01-01T00:00:00.000Z',
    notes: null,
  });

  app = await createAppUpdatesApp(store);
});

afterAll(async () => {
  await app.close();
});

describe('GET android/download', () => {
  it('sert le fichier entier en 200 et annonce accepter les plages', async () => {
    const response = await app.inject({ method: 'GET', url: DOWNLOAD_URL });

    expect(response.statusCode).toBe(200);
    expect(response.headers['accept-ranges']).toBe('bytes');
    expect(response.headers['content-type']).toBe('application/vnd.android.package-archive');
    expect(response.headers['content-length']).toBe(String(CONTENT.length));
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename="cpi-go-42-test.apk"',
    );
    expect(response.rawPayload.equals(CONTENT)).toBe(true);
  });

  it('bytes=-500 renvoie la QUEUE du fichier, jamais sa tête', async () => {
    const response = await app.inject({
      method: 'GET',
      url: DOWNLOAD_URL,
      headers: { range: 'bytes=-500' },
    });

    expect(response.statusCode).toBe(206);
    expect(response.headers['content-range']).toBe('bytes 1500-1999/2000');
    expect(response.headers['content-length']).toBe('500');
    expect(response.rawPayload.equals(CONTENT.subarray(1_500))).toBe(true);
    expect(response.rawPayload.equals(CONTENT.subarray(0, 500))).toBe(false);
  });

  it('bytes=0-99 renvoie les 100 premiers octets', async () => {
    const response = await app.inject({
      method: 'GET',
      url: DOWNLOAD_URL,
      headers: { range: 'bytes=0-99' },
    });

    expect(response.statusCode).toBe(206);
    expect(response.headers['content-range']).toBe('bytes 0-99/2000');
    expect(response.rawPayload.equals(CONTENT.subarray(0, 100))).toBe(true);
  });

  it('bytes=1500- reprend à l’octet demandé jusqu’à la fin', async () => {
    const response = await app.inject({
      method: 'GET',
      url: DOWNLOAD_URL,
      headers: { range: 'bytes=1500-' },
    });

    expect(response.statusCode).toBe(206);
    expect(response.headers['content-range']).toBe('bytes 1500-1999/2000');
    expect(response.rawPayload.equals(CONTENT.subarray(1_500))).toBe(true);
  });

  it('une plage hors du fichier donne 416 avec la taille totale', async () => {
    const response = await app.inject({
      method: 'GET',
      url: DOWNLOAD_URL,
      headers: { range: 'bytes=5000-6000' },
    });

    expect(response.statusCode).toBe(416);
    expect(response.headers['content-range']).toBe('bytes */2000');
  });

  it('publie un ETag, indispensable à If-Range', async () => {
    const response = await app.inject({ method: 'GET', url: DOWNLOAD_URL });

    expect(response.headers.etag).toBeDefined();
    expect(String(response.headers.etag)).toMatch(/"/);
  });

  it('un If-Range périmé fait retomber sur une réponse complète en 200', async () => {
    const response = await app.inject({
      method: 'GET',
      url: DOWNLOAD_URL,
      headers: { range: 'bytes=-500', 'if-range': '"validateur-perime"' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-range']).toBeUndefined();
    expect(response.rawPayload.equals(CONTENT)).toBe(true);
  });

  it('un If-Range à jour honore la plage demandée', async () => {
    const first = await app.inject({ method: 'GET', url: DOWNLOAD_URL });
    const etag = String(first.headers.etag);

    const response = await app.inject({
      method: 'GET',
      url: DOWNLOAD_URL,
      headers: { range: 'bytes=-500', 'if-range': etag },
    });

    expect(response.statusCode).toBe(206);
    expect(response.rawPayload.equals(CONTENT.subarray(1_500))).toBe(true);
  });

  it('une release référencée mais absente du disque reste une 404 explicite', async () => {
    const orphan = new FakeReleaseStore();
    orphan.seed({
      versionName: '9.9.9',
      versionCode: 99,
      forceUpdate: false,
      fileName: 'introuvable.apk',
      fileSize: 1,
      sha256: 'peu-importe',
      publishedAt: '2026-01-01T00:00:00.000Z',
      notes: null,
    });
    const other = await createAppUpdatesApp(orphan);
    try {
      const response = await other.inject({ method: 'GET', url: DOWNLOAD_URL });
      expect(response.statusCode).toBe(404);
    } finally {
      await other.close();
    }
  });
});
