import { mkdtemp, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { DUMP_MAX_RUNTIME_MS } from './db-dump.job.js';
import {
  createDumpApp,
  FakeDumpRunner,
  FakeDumpStore,
  FakeNotifications,
} from './fake-dump-store.js';

const STATE_URL = '/api/v1/admin/database-dump';
const DOWNLOAD_URL = '/api/v1/admin/database-dump/download';

let app: NestFastifyApplication;
let store: FakeDumpStore;
let runner: FakeDumpRunner;
let notifications: FakeNotifications;
let directory: string;

interface StateBody {
  id: string | null;
  status: string;
  requestedByName: string | null;
  fileSize: number | null;
  sha256: string | null;
  expiresAt: string | null;
  failureReason: string | null;
  noticeStatus: string | null;
  noticeDetail: string | null;
  downloadable: boolean;
}

const state = async (): Promise<StateBody> =>
  (await app.inject({ method: 'GET', url: STATE_URL })).json<StateBody>();

async function settle(): Promise<StateBody> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const body = await state();
    if (body.status !== 'queued' && body.status !== 'running') return body;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('l’export n’a jamais quitté l’état « en cours »');
}

const files = async (): Promise<string[]> => readdir(directory).catch(() => []);

beforeAll(() => {
  process.env.NODE_ENV ??= 'test';
  process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
  process.env.JWT_ACCESS_SECRET ??= 'db-dump-access-secret-32-characters-x';
  process.env.JWT_REFRESH_SECRET ??= 'db-dump-refresh-secret-32-characters-x';
});

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'cpi-dumps-'));
  process.env.DB_DUMP_DIR = directory;
  process.env.DB_DUMP_ENABLED = 'true';
  store = new FakeDumpStore();
  runner = new FakeDumpRunner();
  notifications = new FakeNotifications();
  app = await createDumpApp({ store, runner, notifications });
});

afterEach(async () => {
  await app.close();
});

describe('état initial', () => {
  it('annonce « idle » tant qu’aucun export n’a jamais été demandé', async () => {
    const body = await state();
    expect(body.status).toBe('idle');
    expect(body.id).toBeNull();
    expect(body.downloadable).toBe(false);
  });

  it('refuse le téléchargement quand rien n’est prêt', async () => {
    const response = await app.inject({ method: 'GET', url: DOWNLOAD_URL });
    expect(response.statusCode).toBe(404);
    expect(response.json<{ code: string }>().code).toBe('DATABASE_DUMP_NOT_READY');
  });
});

describe('demande d’export', () => {
  it('rend immédiatement un identifiant et un état, avant que le fichier n’existe', async () => {
    runner.hold();
    const response = await app.inject({ method: 'POST', url: STATE_URL });

    expect(response.statusCode).toBe(202);
    const body = response.json<StateBody>();
    expect(body.id).not.toBeNull();
    expect(['queued', 'running']).toContain(body.status);
    expect(body.downloadable).toBe(false);
    expect(await files()).toEqual([]);

    runner.release();
    await settle();
  });

  it('produit un export prêt, avec sa taille, son empreinte et son échéance', async () => {
    await app.inject({ method: 'POST', url: STATE_URL });
    const body = await settle();

    expect(body.status).toBe('ready');
    expect(body.downloadable).toBe(true);
    expect(body.fileSize).toBeGreaterThan(0);
    expect(body.sha256).toMatch(/^[0-9a-f]{64}$/u);
    expect(Date.parse(body.expiresAt ?? '')).toBeGreaterThan(Date.now());
    expect(body.requestedByName).toBe('Admin CPI');
    expect(await files()).toHaveLength(1);
  });

  it('rend l’export en cours au lieu d’en démarrer un second', async () => {
    runner.hold();
    const first = (await app.inject({ method: 'POST', url: STATE_URL })).json<StateBody>();
    const second = (await app.inject({ method: 'POST', url: STATE_URL })).json<StateBody>();

    expect(second.id).toBe(first.id);
    expect(['queued', 'running']).toContain(second.status);

    runner.release();
    await settle();
    expect(runner.calls).toBe(1);
    expect(await files()).toHaveLength(1);
  });

  it('journalise la demande au nom de l’administrateur', async () => {
    await app.inject({ method: 'POST', url: STATE_URL });
    await settle();

    const requested = store.audits.filter((row) => row.action === 'DATABASE_DUMP_REQUESTED');
    expect(requested).toHaveLength(1);
    expect(requested[0]?.userId).toBe('0199a000-0000-7000-8000-000000000001');
    expect(requested[0]?.entity).toBe('database');
  });

  it('balaie les fichiers orphelins avant de commencer', async () => {
    await writeFile(join(directory, 'cpi-base-orphelin.sql.gz'), 'restes d’un export perdu');
    expect(await files()).toHaveLength(1);

    await app.inject({ method: 'POST', url: STATE_URL });
    await settle();

    const remaining = await files();
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).not.toBe('cpi-base-orphelin.sql.gz');
  });
});

describe('téléchargement', () => {
  it('sert une archive gzip réellement décompressable', async () => {
    await app.inject({ method: 'POST', url: STATE_URL });
    await settle();

    const response = await app.inject({ method: 'GET', url: DOWNLOAD_URL });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('application/gzip');
    expect(String(response.headers['content-disposition'])).toContain('.sql.gz');
    expect(gunzipSync(response.rawPayload).toString('utf8')).toContain('CREATE TABLE prospects');
  });

  it('détruit le fichier une fois le téléchargement terminé', async () => {
    await app.inject({ method: 'POST', url: STATE_URL });
    await settle();
    expect(await files()).toHaveLength(1);

    await app.inject({ method: 'GET', url: DOWNLOAD_URL });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(await files()).toEqual([]);
    const body = await state();
    expect(body.status).toBe('expired');
    expect(body.downloadable).toBe(false);
  });

  it('refuse un second téléchargement du même export', async () => {
    await app.inject({ method: 'POST', url: STATE_URL });
    await settle();
    await app.inject({ method: 'GET', url: DOWNLOAD_URL });
    await new Promise((resolve) => setTimeout(resolve, 50));

    const second = await app.inject({ method: 'GET', url: DOWNLOAD_URL });
    expect(second.statusCode).toBe(404);
  });

  it('journalise le téléchargement au nom de l’administrateur', async () => {
    await app.inject({ method: 'POST', url: STATE_URL });
    await settle();
    await app.inject({ method: 'GET', url: DOWNLOAD_URL });

    const downloaded = store.audits.filter((row) => row.action === 'DATABASE_DUMP_DOWNLOADED');
    expect(downloaded).toHaveLength(1);
    expect(downloaded[0]?.userId).toBe('0199a000-0000-7000-8000-000000000001');
  });

  it('remet l’état d’accord avec le disque quand le fichier a disparu', async () => {
    store.seed({
      id: 'job-fantome',
      status: 'ready',
      requestedById: '0199a000-0000-7000-8000-000000000001',
      requestedByName: 'Admin CPI',
      requestedAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      fileName: 'cpi-base-absent.sql.gz',
      fileSize: 10,
      sha256: 'a'.repeat(64),
      expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
      downloadedAt: null,
      failureReason: null,
      noticeStatus: 'SENT',
      noticeDetail: null,
    });

    const response = await app.inject({ method: 'GET', url: DOWNLOAD_URL });
    expect(response.statusCode).toBe(404);
    expect((await state()).status).toBe('expired');
  });
});

describe('échéance', () => {
  it('détruit le fichier échu et le déclare « expired »', async () => {
    await app.inject({ method: 'POST', url: STATE_URL });
    const ready = await settle();
    expect(ready.status).toBe('ready');
    expect(await files()).toHaveLength(1);

    const stored = store.stored() as Record<string, unknown>;
    store.seed({ ...stored, expiresAt: new Date(Date.now() - 1_000).toISOString() });

    const body = await state();
    expect(body.status).toBe('expired');
    expect(body.downloadable).toBe(false);
    expect(await files()).toEqual([]);
  });

  it('refuse le téléchargement d’un export échu', async () => {
    await app.inject({ method: 'POST', url: STATE_URL });
    await settle();
    const stored = store.stored() as Record<string, unknown>;
    store.seed({ ...stored, expiresAt: new Date(Date.now() - 1_000).toISOString() });

    expect((await app.inject({ method: 'GET', url: DOWNLOAD_URL })).statusCode).toBe(404);
  });

  it('enterre un export interrompu et laisse en relancer un autre', async () => {
    store.seed({
      id: 'job-abandonne',
      status: 'running',
      requestedById: '0199a000-0000-7000-8000-000000000001',
      requestedByName: 'Admin CPI',
      requestedAt: new Date(Date.now() - DUMP_MAX_RUNTIME_MS - 60_000).toISOString(),
      startedAt: new Date(Date.now() - DUMP_MAX_RUNTIME_MS - 60_000).toISOString(),
      finishedAt: null,
      fileName: null,
      fileSize: null,
      sha256: null,
      expiresAt: null,
      downloadedAt: null,
      failureReason: null,
      noticeStatus: null,
      noticeDetail: null,
    });

    const stalled = await state();
    expect(stalled.status).toBe('failed');
    expect(stalled.failureReason).toContain('interrompu');

    const restarted = (await app.inject({ method: 'POST', url: STATE_URL })).json<StateBody>();
    expect(restarted.id).not.toBe('job-abandonne');
    expect((await settle()).status).toBe('ready');
  });
});

describe('échec de pg_dump', () => {
  it('rapporte l’échec avec le motif, et n’abandonne aucun fichier', async () => {
    runner.failWith = 'pg_dump: server version mismatch';

    await app.inject({ method: 'POST', url: STATE_URL });
    const body = await settle();

    expect(body.status).toBe('failed');
    expect(body.failureReason).toContain('server version mismatch');
    expect(body.downloadable).toBe(false);
    expect(await files()).toEqual([]);
  });

  it('laisse relancer un export après un échec', async () => {
    runner.failWith = 'pg_dump: server version mismatch';
    await app.inject({ method: 'POST', url: STATE_URL });
    expect((await settle()).status).toBe('failed');

    runner.failWith = null;
    await app.inject({ method: 'POST', url: STATE_URL });
    expect((await settle()).status).toBe('ready');
  });
});

describe('avis de fin', () => {
  it('prévient l’administrateur qui a demandé l’export', async () => {
    await app.inject({ method: 'POST', url: STATE_URL });
    await settle();

    expect(notifications.sent).toHaveLength(1);
    expect(notifications.sent[0]).toMatchObject({
      title: 'Export prêt',
      body: 'Téléchargez-le dans Paramètres > Export intégral.',
      route: '/parametres',
    });
    expect(notifications.sent[0]?.audienceUserIds).toEqual([
      '0199a000-0000-7000-8000-000000000001',
    ]);
  });

  it('n’écrit AUCUN lien ni jeton dans le message', async () => {
    await app.inject({ method: 'POST', url: STATE_URL });
    await settle();

    const message = `${notifications.sent[0]?.title ?? ''} ${notifications.sent[0]?.body ?? ''}`;
    expect(message).not.toMatch(/https?:\/\//u);
    expect(message).not.toContain('/api/');
    expect(message).not.toContain('token');
  });

  it('n’annonce que la cloche, quoi que dise le transport e-mail', async () => {
    notifications.transportStatus = 'NOT_CONFIGURED';

    await app.inject({ method: 'POST', url: STATE_URL });
    const body = await settle();

    expect(body.status).toBe('ready');
    expect(body.downloadable).toBe(true);
    expect(body.noticeStatus).toBe('INBOX_ONLY');
    expect(body.noticeStatus).not.toBe('SENT');
    expect(notifications.sent).toHaveLength(1);
    expect(notifications.sent[0]?.audienceUserIds).toEqual([
      '0199a000-0000-7000-8000-000000000001',
    ]);
  });

  it('n’annonce aucun e-mail dans le corps de l’avis', async () => {
    await app.inject({ method: 'POST', url: STATE_URL });
    await settle();

    const message = `${notifications.sent[0]?.title ?? ''} ${notifications.sent[0]?.body ?? ''}`;
    expect(message).not.toMatch(/e-mail|courriel|mail/iu);
  });

  it('aboutit même si l’avis lève, et porte le motif', async () => {
    notifications.throwWith = 'Brevo injoignable';

    await app.inject({ method: 'POST', url: STATE_URL });
    const body = await settle();

    expect(body.status).toBe('ready');
    expect(body.downloadable).toBe(true);
    expect(body.noticeStatus).toBe('FAILED');
    expect(body.noticeDetail).toContain('Brevo injoignable');
  });
});
