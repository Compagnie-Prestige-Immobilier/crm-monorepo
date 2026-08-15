import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createAppUpdatesApp, FakeReleaseStore, multipartBody } from './fake-release-store.js';

/**
 * Validation des champs du formulaire de publication.
 *
 * POURQUOI CE FICHIER EXISTE.
 *
 * Les champs d'un envoi multipart n'entrent pas dans le `ValidationPipe`
 * global : le corps est un flux, le contrôleur reçoit la requête brute, et Nest
 * ne construit jamais le DTO. Les `@MaxLength` d'`AppUpdateUploadDto` étaient
 * donc de la décoration pure, et la valeur non contrôlée ressortait par
 * `GET android/current`, route PUBLIQUE que chaque installation interroge au
 * démarrage. Une note démesurée s'y serait retrouvée servie à tout le parc, à
 * chaque ouverture de l'application.
 */

const UPLOAD_URL = '/api/v1/app-updates/android';
const CURRENT_URL = '/api/v1/app-updates/android/current?versionCode=0';
const APK = { name: 'cpi-go.apk', content: Buffer.from('contenu-apk-de-test') };

let app: NestFastifyApplication;
let store: FakeReleaseStore;

beforeAll(async () => {
  process.env.NODE_ENV ??= 'test';
  process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
  process.env.JWT_ACCESS_SECRET ??= 'app-updates-access-secret-32-characters';
  process.env.JWT_REFRESH_SECRET ??= 'app-updates-refresh-secret-32-characters';
  process.env.APK_RELEASE_DIR = await mkdtemp(join(tmpdir(), 'cpi-uploads-'));

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

const upload = (fields: Record<string, string>) =>
  app.inject({ method: 'POST', url: UPLOAD_URL, ...multipartBody(fields, APK) });

describe('POST android (champs multipart)', () => {
  /**
   * Le test le plus important du fichier : il vérifie le REFUS, puis que la
   * valeur refusée n'est pas devenue lisible publiquement. La seconde moitié
   * est celle qui aurait échoué même si le service avait répondu 400 tout en
   * enregistrant quand même.
   */
  it('refuse une note plus longue que la limite du DTO et ne la publie pas', async () => {
    const notes = 'a'.repeat(2_001);

    const response = await upload({
      versionName: '1.5.0',
      versionCode: '5',
      forceUpdate: 'false',
      notes,
    });

    expect(response.statusCode).toBe(400);
    expect(store.stored()).not.toContain('aaaa');

    const current = await app.inject({ method: 'GET', url: CURRENT_URL });
    expect(current.statusCode).toBe(200);
    expect(current.body).not.toContain('aaaa');
    expect(current.json<{ notes: string | null }>().notes).toBe('note initiale');
  });

  it('refuse un versionName plus long que la limite du DTO', async () => {
    const response = await upload({
      versionName: 'v'.repeat(33),
      versionCode: '5',
      forceUpdate: 'false',
    });

    expect(response.statusCode).toBe(400);
  });

  it('refuse un versionCode non entier plutôt que de le lire comme zéro', async () => {
    const response = await upload({
      versionName: '1.5.0',
      versionCode: '1.5',
      forceUpdate: 'false',
    });

    expect(response.statusCode).toBe(400);
  });

  it('refuse un versionCode illisible', async () => {
    const response = await upload({
      versionName: '1.5.0',
      versionCode: 'douze',
      forceUpdate: 'false',
    });

    expect(response.statusCode).toBe(400);
  });

  it('refuse un forceUpdate qui n’est ni true ni false', async () => {
    const response = await upload({
      versionName: '1.5.0',
      versionCode: '5',
      forceUpdate: 'oui',
    });

    expect(response.statusCode).toBe(400);
  });

  /**
   * Contre-épreuve : sans elle, un service qui refuserait TOUT ferait passer
   * les tests ci-dessus sans rien prouver.
   */
  it('accepte une release conforme et la publie', async () => {
    const response = await upload({
      versionName: '1.5.0',
      versionCode: '5',
      forceUpdate: 'true',
      notes: 'Corrige la reprise de téléchargement.',
    });

    expect(response.statusCode).toBe(201);

    const current = await app.inject({ method: 'GET', url: CURRENT_URL });
    const body = current.json<{ available: boolean; notes: string | null; versionCode: number }>();
    expect(body.available).toBe(true);
    expect(body.versionCode).toBe(5);
    expect(body.notes).toBe('Corrige la reprise de téléchargement.');
  });
});
