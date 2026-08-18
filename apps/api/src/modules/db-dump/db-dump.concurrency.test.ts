import { mkdtemp, readdir, readFile, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { DbDumpService } from './db-dump.service.js';
import { DUMP_TTL_MS } from './db-dump.job.js';
import {
  createDumpApp,
  FAKE_ADMIN,
  FakeDumpRunner,
  FakeDumpStore,
  FakeNotifications,
} from './fake-dump-store.js';

const STATE_URL = '/api/v1/admin/database-dump';
const DOWNLOAD_URL = '/api/v1/admin/database-dump/download';

let app: NestFastifyApplication;
let store: FakeDumpStore;
let runner: FakeDumpRunner;
let directory: string;

const files = async (): Promise<string[]> => readdir(directory).catch(() => []);

const settle = async (): Promise<{ status: string }> => {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const body = (await app.inject({ method: 'GET', url: STATE_URL })).json<{ status: string }>();
    if (body.status !== 'queued' && body.status !== 'running') {
      return body;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('l’export n’a jamais quitté l’état « en cours »');
};

beforeAll(() => {
  process.env.NODE_ENV ??= 'test';
  process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
  process.env.JWT_ACCESS_SECRET ??= 'db-dump-access-secret-32-characters-x';
  process.env.JWT_REFRESH_SECRET ??= 'db-dump-refresh-secret-32-characters-x';
});

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), 'cpi-dumps-race-'));
  process.env.DB_DUMP_DIR = directory;
  process.env.DB_DUMP_ENABLED = 'true';
  store = new FakeDumpStore();
  runner = new FakeDumpRunner();
  app = await createDumpApp({ store, runner, notifications: new FakeNotifications() });
});

afterEach(async () => {
  await app.close();
});

describe('deux demandes simultanées', () => {
  it('ne lance qu’un seul pg_dump, et le perdant est refusé', async () => {
    runner.hold();

    const [first, second] = await Promise.all([
      app.inject({ method: 'POST', url: STATE_URL }),
      app.inject({ method: 'POST', url: STATE_URL }),
    ]);

    const codes = [first.statusCode, second.statusCode].sort((a, b) => a - b);
    expect(codes).toEqual([202, 409]);

    const loser = first.statusCode === 409 ? first : second;
    expect(loser.json<{ code: string }>().code).toBe('DATABASE_DUMP_IN_PROGRESS');

    runner.release();
    await settle();

    expect(runner.calls).toBe(1);
    expect(await files()).toHaveLength(1);
  });

  it('arbitre aussi quand une ligne d’export précédente existe déjà', async () => {
    store.seed({
      id: 'job-precedent',
      status: 'expired',
      requestedById: FAKE_ADMIN.id,
      requestedByName: FAKE_ADMIN.fullName,
      requestedAt: new Date(Date.now() - DUMP_TTL_MS).toISOString(),
      startedAt: null,
      finishedAt: null,
      fileName: null,
      fileSize: null,
      sha256: null,
      expiresAt: null,
      reservedAt: null,
      downloadedAt: null,
      failureReason: null,
      noticeStatus: null,
      noticeDetail: null,
    });
    runner.hold();

    const responses = await Promise.all([
      app.inject({ method: 'POST', url: STATE_URL }),
      app.inject({ method: 'POST', url: STATE_URL }),
    ]);

    expect(responses.map((r) => r.statusCode).sort((a, b) => a - b)).toEqual([202, 409]);

    runner.release();
    await settle();
    expect(runner.calls).toBe(1);
  });

  it('refuse une nouvelle demande tant qu’une archive est prête, sans y toucher', async () => {
    await app.inject({ method: 'POST', url: STATE_URL });
    await settle();
    const before = await files();
    expect(before).toHaveLength(1);

    const again = await app.inject({ method: 'POST', url: STATE_URL });

    expect(again.statusCode).toBe(409);
    expect(again.json<{ code: string }>().code).toBe('DATABASE_DUMP_ALREADY_READY');
    expect(runner.calls).toBe(1);
    expect(await files()).toEqual(before);
  });
});

describe('la ligne d’état change de main pendant le passage à « running »', () => {
  it('abandonne l’export sans jamais lancer pg_dump', async () => {
    store.onBeforeConditionalWrite = () => {
      store.seed({
        id: 'job-voleur',
        status: 'queued',
        requestedById: FAKE_ADMIN.id,
        requestedByName: FAKE_ADMIN.fullName,
        requestedAt: new Date().toISOString(),
        startedAt: null,
        finishedAt: null,
        fileName: null,
        fileSize: null,
        sha256: null,
        expiresAt: null,
        reservedAt: null,
        downloadedAt: null,
        failureReason: null,
        noticeStatus: null,
        noticeDetail: null,
      });
      return Promise.resolve();
    };

    const response = await app.inject({ method: 'POST', url: STATE_URL });
    expect(response.statusCode).toBe(202);

    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(runner.calls).toBe(0);
    expect(await files()).toEqual([]);
    expect(store.stored()?.id).toBe('job-voleur');
    expect(store.stored()?.status).toBe('queued');
  });

  it('va au bout quand la ligne lui appartient encore', async () => {
    await app.inject({ method: 'POST', url: STATE_URL });

    expect((await settle()).status).toBe('ready');
    expect(runner.calls).toBe(1);
    expect(await files()).toHaveLength(1);
  });
});

describe('deux téléchargements simultanés', () => {
  it('n’en sert qu’un, et refuse l’autre en 409', async () => {
    await app.inject({ method: 'POST', url: STATE_URL });
    await settle();

    const responses = await Promise.all([
      app.inject({ method: 'GET', url: DOWNLOAD_URL }),
      app.inject({ method: 'GET', url: DOWNLOAD_URL }),
    ]);

    const served = responses.filter((r) => r.statusCode === 200);
    const refused = responses.filter((r) => r.statusCode !== 200);

    expect(served).toHaveLength(1);
    expect(refused).toHaveLength(1);
    expect(refused[0]?.json<{ code: string }>().code).toBe('DATABASE_DUMP_DELIVERING');
    expect(served[0]?.rawPayload.length).toBeGreaterThan(0);
  });

  it('affirme que l’archive n’est pas une démonstration', async () => {
    await app.inject({ method: 'POST', url: STATE_URL });
    await settle();

    const response = await app.inject({ method: 'GET', url: DOWNLOAD_URL });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-demo-mode']).toBe('false');
  });
});

describe('requête HEAD sur le téléchargement', () => {
  it('ne détruit pas l’archive et n’écrit aucune trace', async () => {
    await app.inject({ method: 'POST', url: STATE_URL });
    await settle();
    const before = await files();
    expect(before).toHaveLength(1);

    const head = await app.inject({ method: 'HEAD', url: DOWNLOAD_URL });
    expect(head.statusCode).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(await files()).toEqual(before);
    expect(store.audits.filter((row) => row.action === 'DATABASE_DUMP_DOWNLOADED')).toHaveLength(0);
    expect((await app.inject({ method: 'GET', url: DOWNLOAD_URL })).statusCode).toBe(200);
  });
});

describe('lien symbolique déposé dans le répertoire', () => {
  it('refuse de servir un fichier atteint par un lien', async () => {
    const secret = join(directory, 'secret-hors-export.txt');
    await writeFile(secret, 'clé privée du serveur');
    const fileName = 'cpi-base-20260815T120000-piege.sql.gz';
    await symlink(secret, join(directory, fileName));

    store.seed({
      id: 'job-piege',
      status: 'ready',
      requestedById: FAKE_ADMIN.id,
      requestedByName: FAKE_ADMIN.fullName,
      requestedAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      fileName,
      fileSize: 21,
      sha256: 'a'.repeat(64),
      expiresAt: new Date(Date.now() + DUMP_TTL_MS).toISOString(),
      reservedAt: null,
      downloadedAt: null,
      failureReason: null,
      noticeStatus: 'SENT',
      noticeDetail: null,
    });

    const response = await app.inject({ method: 'GET', url: DOWNLOAD_URL });

    expect(response.statusCode).toBe(404);
    expect(response.body).not.toContain('clé privée');
    expect(await readFile(secret, 'utf8')).toBe('clé privée du serveur');
  });
});

describe('réconciliation d’amorçage', () => {
  const service = (): DbDumpService => app.get(DbDumpService);

  it('efface une archive que plus aucune ligne ne nomme', async () => {
    await writeFile(join(directory, 'cpi-base-20260815T090000-orphelin.sql.gz'), 'partiel');

    await service().sweep(new Date(), true);

    expect(await files()).toEqual([]);
  });

  it('détruit une archive échue sans que personne n’ait ouvert l’écran', async () => {
    const fileName = 'cpi-base-20260815T090000-echu.sql.gz';
    await writeFile(join(directory, fileName), 'archive complète');
    store.seed({
      id: 'job-echu',
      status: 'ready',
      requestedById: FAKE_ADMIN.id,
      requestedByName: FAKE_ADMIN.fullName,
      requestedAt: new Date(Date.now() - DUMP_TTL_MS * 2).toISOString(),
      startedAt: new Date(Date.now() - DUMP_TTL_MS * 2).toISOString(),
      finishedAt: new Date(Date.now() - DUMP_TTL_MS * 2).toISOString(),
      fileName,
      fileSize: 16,
      sha256: 'b'.repeat(64),
      expiresAt: new Date(Date.now() - 1_000).toISOString(),
      reservedAt: null,
      downloadedAt: null,
      failureReason: null,
      noticeStatus: 'SENT',
      noticeDetail: null,
    });

    await service().sweepExpired();

    expect(await files()).toEqual([]);
    expect(store.stored()?.status).toBe('expired');
  });

  it('détruit une archive dont la livraison a été interrompue par un arrêt', async () => {
    const fileName = 'cpi-base-20260815T090000-reserve.sql.gz';
    await writeFile(join(directory, fileName), 'archive complète');
    store.seed({
      id: 'job-reserve',
      status: 'ready',
      requestedById: FAKE_ADMIN.id,
      requestedByName: FAKE_ADMIN.fullName,
      requestedAt: new Date().toISOString(),
      startedAt: new Date().toISOString(),
      finishedAt: new Date().toISOString(),
      fileName,
      fileSize: 16,
      sha256: 'c'.repeat(64),
      expiresAt: new Date(Date.now() + DUMP_TTL_MS).toISOString(),
      reservedAt: new Date(Date.now() - 1_000).toISOString(),
      downloadedAt: null,
      failureReason: null,
      noticeStatus: 'SENT',
      noticeDetail: null,
    });

    await service().onModuleInit();

    expect(await files()).toEqual([]);
    expect(store.stored()?.status).toBe('expired');
    expect((await app.inject({ method: 'GET', url: DOWNLOAD_URL })).statusCode).toBe(404);
  });

  it('ne touche pas à une archive prête, valide et non réservée', async () => {
    await app.inject({ method: 'POST', url: STATE_URL });
    await settle();
    const before = await files();
    expect(before).toHaveLength(1);

    await service().sweep();

    expect(await files()).toEqual(before);
    expect((await app.inject({ method: 'GET', url: DOWNLOAD_URL })).statusCode).toBe(200);
  });

  it('ne détruit pas la sortie d’un pg_dump EN COURS', async () => {
    runner.holdWithOutput();
    await app.inject({ method: 'POST', url: STATE_URL });

    for (let attempt = 0; attempt < 200 && (await files()).length === 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    const enCours = await files();
    expect(enCours).toHaveLength(1);

    await service().sweepExpired();

    expect(await files()).toEqual(enCours);

    runner.release();
    expect((await settle()).status).toBe('ready');
  });
});

function sweepsPerHour(expression: string): number {
  const fields = expression.trim().split(/\s+/u);
  const minute = (fields.length === 6 ? fields[1] : fields[0]) ?? '*';
  const [range = '*', step] = minute.split('/');
  const every = step === undefined ? 1 : Number(step);
  const bounds = range === '*' ? [0, 59] : range.split('-').map(Number);
  const from = bounds[0] ?? 0;
  const to = bounds[1] ?? from;
  let count = 0;
  for (let m = from; m <= to; m += every) count += 1;
  return count;
}

describe('cadence du balayage périodique', () => {
  it('borne le dépassement de l’échéance à une petite fraction des six heures', () => {
    const handler = Object.getOwnPropertyDescriptor(DbDumpService.prototype, 'sweepExpired')
      ?.value as object | undefined;
    const options = Reflect.getMetadata('SCHEDULE_CRON_OPTIONS', handler ?? {}) as
      { cronTime: string } | undefined;
    expect(options?.cronTime).toBeTypeOf('string');

    const overshootMs = 3_600_000 / sweepsPerHour(options?.cronTime ?? '');

    expect(overshootMs).toBe(10 * 60 * 1_000);
    expect(overshootMs / DUMP_TTL_MS).toBeLessThan(0.03);
  });

  it('lit bien la cadence, y compris la forme horaire à cinq champs', () => {
    expect(sweepsPerHour('0 */10 * * * *')).toBe(6);
    expect(sweepsPerHour('0 0-23/1 * * *')).toBe(1);
    expect(sweepsPerHour('0 */30 * * * *')).toBe(2);
  });
});
