import { readFile, readdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { FastifyRequest } from 'fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { AppUpdatesService } from './app-updates.service.js';
import {
  createAppUpdatesApp,
  FAKE_ADMIN,
  FakeReleaseStore,
  multipartBody,
} from './fake-release-store.js';

const UPLOAD_URL = '/api/v1/app-updates/android';
const CURRENT_URL = '/api/v1/app-updates/android/current?versionCode=0';

const fixturePath = (name: string): string =>
  fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

let app: NestFastifyApplication;
let store: FakeReleaseStore;
let releaseDir: string;
let cpiGoV7: Buffer;

beforeAll(async () => {
  process.env.NODE_ENV ??= 'test';
  process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
  process.env.JWT_ACCESS_SECRET ??= 'app-updates-access-secret-32-characters';
  process.env.JWT_REFRESH_SECRET ??= 'app-updates-refresh-secret-32-characters';
  releaseDir = await mkdtemp(join(tmpdir(), 'cpi-uploads-'));
  process.env.APK_RELEASE_DIR = releaseDir;

  cpiGoV7 = await readFile(fixturePath('cpi-go-v7.apk'));
  store = new FakeReleaseStore();
  app = await createAppUpdatesApp(store);
});

beforeEach(() => {
  store.seed({
    versionName: '1.0.0',
    versionCode: 1,
    forceUpdate: false,
    fileName: 'cpi-go-1-initial.apk',
    fileSize: 10,
    sha256: 'x'.repeat(64),
    publishedAt: '2026-01-01T00:00:00.000Z',
    notes: 'note initiale',
  });
});

afterAll(async () => {
  await app.close();
});

const uploadFile = (fields: Record<string, string>, apk: Buffer, name = 'cpi-go.apk') =>
  app.inject({
    method: 'POST',
    url: UPLOAD_URL,
    ...multipartBody(fields, { name, content: apk }),
  });

const upload = (fields: Record<string, string>) => uploadFile(fields, cpiGoV7);

const uploadTrailing = (fields: Record<string, string>) =>
  app.inject({
    method: 'POST',
    url: UPLOAD_URL,
    ...multipartBody({}, { name: 'cpi-go.apk', content: cpiGoV7 }, fields),
  });

const releaseFiles = async (): Promise<string[]> => readdir(releaseDir);

describe('POST android (champs multipart)', () => {
  it('refuse une note plus longue que la limite du DTO et ne la publie pas', async () => {
    const response = await upload({ forceUpdate: 'false', notes: 'a'.repeat(2_001) });

    expect(response.statusCode).toBe(400);
    expect(store.stored()).not.toContain('aaaa');

    const current = await app.inject({ method: 'GET', url: CURRENT_URL });
    expect(current.statusCode).toBe(200);
    expect(current.body).not.toContain('aaaa');
    expect(current.json<{ notes: string | null }>().notes).toBe('note initiale');
  });

  it('refuse un forceUpdate qui n’est ni true ni false', async () => {
    expect((await upload({ forceUpdate: 'oui' })).statusCode).toBe(400);
  });

  it('refuse un formulaire qui envoie encore versionName et versionCode', async () => {
    const response = await upload({
      forceUpdate: 'false',
      versionName: '9.9.9',
      versionCode: '99',
    });

    expect(response.statusCode).toBe(400);
    const current = await app.inject({ method: 'GET', url: CURRENT_URL });
    expect(current.json<{ versionCode: number }>().versionCode).toBe(1);
  });

  it('refuse ces mêmes champs quand ils arrivent APRÈS le fichier', async () => {
    const response = await uploadTrailing({
      forceUpdate: 'false',
      versionName: '9.9.9',
      versionCode: '99',
    });

    expect(response.statusCode).toBe(400);
    const current = await app.inject({ method: 'GET', url: CURRENT_URL });
    expect(current.json<{ versionCode: number }>().versionCode).toBe(1);
  });

  it('et accepte un formulaire conforme dont les champs suivent le fichier', async () => {
    const response = await uploadTrailing({ forceUpdate: 'true', notes: 'Champs après fichier.' });

    expect(response.statusCode).toBe(201);
    expect(response.json<{ versionCode: number }>().versionCode).toBe(7);
    const current = await app.inject({ method: 'GET', url: CURRENT_URL });
    expect(current.json<{ notes: string | null }>().notes).toBe('Champs après fichier.');
  });

  it('N’UTILISE PAS `fields` AVANT D’AVOIR CONSOMMÉ LE FLUX', async () => {
    class LateFieldsRequest {
      readonly fields: Record<string, unknown> = {};

      constructor(
        private readonly apk: Buffer,
        private readonly trailing: Record<string, string>,
      ) {}

      async *parts(): AsyncGenerator {
        await Promise.resolve();
        yield {
          type: 'file',
          fieldname: 'file',
          filename: 'cpi-go.apk',
          file: Readable.from([this.apk]),
          fields: this.fields,
        };
        for (const [fieldname, value] of Object.entries(this.trailing)) {
          this.fields[fieldname] = { type: 'field', fieldname, value };
          yield { type: 'field', fieldname, value, fields: this.fields };
        }
      }

      async file(): Promise<unknown> {
        const iterator = this.parts();
        return (await iterator.next()).value;
      }
    }

    const isolated = new AppUpdatesService(store.asService());
    const request = new LateFieldsRequest(cpiGoV7, {
      forceUpdate: 'true',
      notes: 'Champs analysés après le fichier.',
    });

    const published = await isolated.upload(request as unknown as FastifyRequest, FAKE_ADMIN);

    expect(published.forceUpdate).toBe(true);
    expect(published.notes).toBe('Champs analysés après le fichier.');
    expect(published.versionCode).toBe(7);
  });

  it('accepte une release conforme et la publie', async () => {
    const response = await upload({
      forceUpdate: 'true',
      notes: 'Corrige la reprise de téléchargement.',
    });

    expect(response.statusCode).toBe(201);

    const current = await app.inject({ method: 'GET', url: CURRENT_URL });
    const body = current.json<{ available: boolean; notes: string | null; versionCode: number }>();
    expect(body.available).toBe(true);
    expect(body.notes).toBe('Corrige la reprise de téléchargement.');
  });
});

describe('POST android (version lue dans l’APK)', () => {
  it('publie la version lue dans le manifeste, sans qu’aucun champ ne la porte', async () => {
    const response = await upload({ forceUpdate: 'false' });

    expect(response.statusCode).toBe(201);
    const published = response.json<{ versionCode: number; versionName: string }>();
    expect(published.versionCode).toBe(7);
    expect(published.versionName).toBe('1.4.2');

    const current = await app.inject({ method: 'GET', url: CURRENT_URL });
    const body = current.json<{ versionCode: number; versionName: string }>();
    expect(body.versionCode).toBe(7);
    expect(body.versionName).toBe('1.4.2');
  });

  it('publie une version DIFFÉRENTE pour un APK différent', async () => {
    const response = await uploadFile(
      { forceUpdate: 'false' },
      await readFile(fixturePath('cpi-go-v12.apk')),
    );

    expect(response.statusCode).toBe(201);
    expect(response.json<{ versionCode: number }>().versionCode).toBe(12);
    expect(response.json<{ versionName: string }>().versionName).toBe('1.9.0');
  });

  it('ignore le nom du fichier téléversé et lit le manifeste', async () => {
    const response = await uploadFile({ forceUpdate: 'false' }, cpiGoV7, 'cpi-go-999-final.apk');

    expect(response.statusCode).toBe(201);
    expect(response.json<{ versionCode: number }>().versionCode).toBe(7);
  });

  it('refuse un APK dont le versionCode ne dépasse pas celui en ligne, en nommant les deux', async () => {
    store.seed({
      versionName: '1.9.0',
      versionCode: 12,
      forceUpdate: false,
      fileName: 'cpi-go-12.apk',
      fileSize: 10,
      sha256: 'x'.repeat(64),
      publishedAt: '2026-01-01T00:00:00.000Z',
      notes: null,
    });

    const response = await upload({ forceUpdate: 'false' });

    expect(response.statusCode).toBe(422);
    expect(response.json<{ code: string }>().code).toBe('APK_VERSION_NOT_GREATER');
    const message = response.json<{ message: string }>().message;
    expect(message).toContain('7');
    expect(message).toContain('12');

    const current = await app.inject({ method: 'GET', url: CURRENT_URL });
    expect(current.json<{ versionCode: number }>().versionCode).toBe(12);
  });

  it('refuse un APK d’un autre éditeur, en nommant son paquet', async () => {
    const response = await uploadFile(
      { forceUpdate: 'false' },
      await readFile(fixturePath('autre-editeur-v99.apk')),
    );

    expect(response.statusCode).toBe(422);
    expect(response.json<{ code: string }>().code).toBe('APK_FOREIGN_PACKAGE');
    expect(response.json<{ message: string }>().message).toContain('com.autre.editeur');

    const current = await app.inject({ method: 'GET', url: CURRENT_URL });
    expect(current.json<{ versionCode: number }>().versionCode).toBe(1);
  });

  it('refuse un manifeste illisible plutôt que de deviner une version', async () => {
    const response = await uploadFile(
      { forceUpdate: 'false' },
      await readFile(fixturePath('manifeste-illisible.apk')),
    );

    expect(response.statusCode).toBe(400);
    expect(response.json<{ code: string }>().code).toBe('APK_MANIFEST_UNREADABLE');

    const current = await app.inject({ method: 'GET', url: CURRENT_URL });
    expect(current.json<{ versionCode: number }>().versionCode).toBe(1);
  });

  it('n’abandonne aucun fichier sur le volume après un refus', async () => {
    const before = await releaseFiles();

    await uploadFile(
      { forceUpdate: 'false' },
      await readFile(fixturePath('autre-editeur-v99.apk')),
    );
    await uploadFile(
      { forceUpdate: 'false' },
      await readFile(fixturePath('manifeste-illisible.apk')),
    );
    await upload({ forceUpdate: 'oui' });

    expect(await releaseFiles()).toEqual(before);
  });
});
