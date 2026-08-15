import { readFile, readdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createAppUpdatesApp, FakeReleaseStore, multipartBody } from './fake-release-store.js';

/**
 * Publication d'une release : champs du formulaire ET version lue dans l'APK.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI CE FICHIER EXISTE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Deux défauts distincts sont gardés ici.
 *
 * 1. Les champs d'un envoi multipart n'entrent pas dans le `ValidationPipe`
 *    global : le corps est un flux, le contrôleur reçoit la requête brute, et
 *    Nest ne construit jamais le DTO. Les `@MaxLength` d'`AppUpdateUploadDto`
 *    étaient donc de la décoration pure, et la valeur non contrôlée ressortait
 *    par `GET android/current`, route PUBLIQUE que chaque installation
 *    interroge au démarrage.
 *
 * 2. `versionName` et `versionCode` étaient SAISIS À LA MAIN. Ils sont
 *    désormais lus dans le manifeste de l'APK. Les tests de la seconde moitié
 *    de ce fichier vérifient que c'est bien le FICHIER qui décide, et que
 *    chaque refus laisse le répertoire des releases propre.
 *
 * Les APK utilisés sont RÉELS (produits par `aapt2`, moins de 700 octets
 * chacun) : voir `apk-manifest.test.ts` pour ce que contient chacun.
 */

const UPLOAD_URL = '/api/v1/app-updates/android';
const CURRENT_URL = '/api/v1/app-updates/android/current?versionCode=0';

const fixturePath = (name: string): string =>
  fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url));

let app: NestFastifyApplication;
let store: FakeReleaseStore;
let releaseDir: string;
/** `sn.cpi.go`, versionCode 7, versionName 1.4.2. */
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

/** APK réellement présents dans le répertoire des releases, `.part` compris. */
const releaseFiles = async (): Promise<string[]> => readdir(releaseDir);

describe('POST android (champs multipart)', () => {
  /**
   * Le test le plus important de la section : il vérifie le REFUS, puis que la
   * valeur refusée n'est pas devenue lisible publiquement. La seconde moitié
   * est celle qui aurait échoué même si le service avait répondu 400 tout en
   * enregistrant quand même.
   */
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

  /**
   * `versionName` et `versionCode` ne sont plus des champs du formulaire. Un
   * panel resté sur l'ancienne version les enverrait encore : il doit
   * l'APPRENDRE par un 400, et non les voir ignorés en silence tout en
   * continuant d'afficher deux formulaires que plus personne ne lit.
   */
  it('refuse un formulaire qui envoie encore versionName et versionCode', async () => {
    const response = await upload({
      forceUpdate: 'false',
      versionName: '9.9.9',
      versionCode: '99',
    });

    expect(response.statusCode).toBe(400);
    // Et surtout : la valeur tapée n'est PAS devenue la version publiée.
    const current = await app.inject({ method: 'GET', url: CURRENT_URL });
    expect(current.json<{ versionCode: number }>().versionCode).toBe(1);
  });

  /**
   * Contre-épreuve : sans elle, un service qui refuserait TOUT ferait passer
   * les tests ci-dessus sans rien prouver.
   */
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
  /**
   * LE test de la fonctionnalité. La version publiée vient du manifeste, et de
   * nulle part ailleurs : aucun champ du formulaire ne la porte plus.
   */
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

  /**
   * Contre-épreuve du test précédent : un second APK doit donner une AUTRE
   * version. Sans elle, une implémentation qui écrirait « 7 » en dur passerait.
   */
  it('publie une version DIFFÉRENTE pour un APK différent', async () => {
    const response = await uploadFile(
      { forceUpdate: 'false' },
      await readFile(fixturePath('cpi-go-v12.apk')),
    );

    expect(response.statusCode).toBe(201);
    expect(response.json<{ versionCode: number }>().versionCode).toBe(12);
    expect(response.json<{ versionName: string }>().versionName).toBe('1.9.0');
  });

  /**
   * Le nom du fichier n'a AUCUNE influence : c'est le manifeste qui parle.
   * Sans ce test, une implémentation qui lirait le nom du téléversement
   * (`cpi-go-42.apk`) passerait tous les autres.
   */
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

    // Et la release en ligne n'a pas bougé : le refus n'a rien réécrit.
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

  /**
   * L'APK ne peut être analysé qu'une fois ÉCRIT : le répertoire central d'un
   * ZIP se trouve à la fin de l'archive. Chaque refus laisse donc, l'espace
   * d'un instant, un fichier de la taille de l'APK sur le volume monté. S'il
   * n'était pas effacé, une poignée de tentatives ratées par mois suffirait à
   * saturer le disque avec des APK que rien ne sert et que rien ne balaie.
   */
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
