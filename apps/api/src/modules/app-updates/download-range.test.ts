import { createHash } from 'node:crypto';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createAppUpdatesApp, FakeReleaseStore } from './fake-release-store.js';

/**
 * Reprises de téléchargement de l'APK.
 *
 * CE QUE CE FICHIER PROTÈGE, ET POURQUOI ÇA MÉRITE UNE APPLICATION COMPLÈTE.
 *
 * Sur le terrain, un APK de plusieurs centaines de mégaoctets n'arrive jamais
 * d'une traite : le DownloadManager Android coupe et REPREND, avec un en-tête
 * `Range`. La RFC 7233 en définit une forme à suffixe, `bytes=-500`, qui
 * désigne les 500 DERNIERS octets. L'analyseur maison qui vivait dans le
 * service la lisait comme « début = 0 » et renvoyait les 501 PREMIERS octets,
 * en annonçant dans `Content-Range` qu'il s'agissait des derniers. Le fichier
 * réassemblé était corrompu, le contrôle sha256 le rejetait, et la tentative
 * suivante reproduisait exactement la même corruption : la mise à jour ne
 * pouvait jamais aboutir, sans qu'aucune erreur serveur n'apparaisse nulle
 * part.
 *
 * Ces en-têtes ne sont produits ni par le service ni par le contrôleur, mais
 * par la couche HTTP. Ils ne sont donc observables qu'en injectant de vraies
 * requêtes dans une vraie application Fastify.
 */

const DOWNLOAD_URL = '/api/v1/app-updates/android/download';

/** 2 000 octets dont la tête et la queue diffèrent : c'est tout l'enjeu. */
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
  // Le service fige le répertoire à sa construction : il faut le poser AVANT
  // de monter l'application.
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

  /**
   * LE BUG D'ORIGINE, ÉPINGLÉ.
   *
   * La double assertion est volontaire : vérifier seulement `Content-Range` ne
   * suffirait pas, l'ancien code en produisait un qui avait l'air juste tout en
   * envoyant les octets du DÉBUT. C'est la comparaison avec la tête du fichier
   * qui distingue les deux comportements.
   */
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

  /**
   * Un client qui reprend un téléchargement sur la foi d'une taille périmée
   * doit être renvoyé à la taille réelle, sinon il boucle sur la même demande.
   */
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

  /**
   * SANS CE COMPORTEMENT, UN APK EST SILENCIEUSEMENT RECOLLÉ.
   *
   * Si la release est remplacée pendant qu'un téléchargement est en cours, la
   * reprise porte le validateur de l'ANCIEN fichier. Répondre 206 collerait la
   * fin du nouveau fichier au début de l'ancien : deux moitiés valides, un
   * fichier faux. La seule réponse correcte est de tout renvoyer.
   */
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
