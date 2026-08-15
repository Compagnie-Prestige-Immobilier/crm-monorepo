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

/**
 * L'export intégral de la base, de bout en bout.
 *
 * Ce que ce fichier garde, et qui ne se voit dans aucun autre :
 *
 *  - le travail est ASYNCHRONE : la demande rend tout de suite, le fichier
 *    apparaît plus tard, et l'écran sonde ;
 *  - UN SEUL export à la fois, une seconde demande rend le même ;
 *  - le fichier est DÉTRUIT après téléchargement, et à l'échéance ;
 *  - la demande ET le téléchargement laissent une trace nommant l'administrateur ;
 *  - un avis de fin qui échoue ne fait pas échouer l'export, mais se VOIT.
 *
 * Le seul élément doublé est `pg_dump`. Les fichiers écrits, lus, hachés et
 * détruits sont de vrais fichiers, dans un vrai répertoire temporaire.
 */

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

/**
 * Attend que le travail de fond quitte les états « en cours ».
 *
 * Un sondage, exactement comme l'écran : le service ne publie aucune poignée
 * de synchronisation réservée aux tests, et lui en ajouter une reviendrait à
 * éprouver un chemin que la production n'emprunte jamais.
 */
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
  // La fonctionnalité est ÉTEINTE par défaut. Ce fichier éprouve ce qu'elle
  // fait quand elle est allumée ; `db-dump.enabled.test.ts` éprouve
  // l'interrupteur lui-même, dans les deux positions.
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
  /**
   * LE test du caractère asynchrone. La réponse arrive AVANT que le fichier
   * n'existe : un service qui attendrait `pg_dump` tiendrait la requête HTTP
   * ouverte pendant des minutes, et le relais Next comme le navigateur la
   * couperaient bien avant la fin.
   */
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

  /**
   * UN SEUL `pg_dump` À LA FOIS. Une base de production ne supporte pas deux
   * exports concurrents, et deux exemplaires complets de la clientèle sur le
   * même volume est précisément ce qu'on cherche à éviter. Le second clic doit
   * rendre le travail EN COURS, pas en démarrer un autre.
   */
  it('rend l’export en cours au lieu d’en démarrer un second', async () => {
    runner.hold();
    const first = (await app.inject({ method: 'POST', url: STATE_URL })).json<StateBody>();
    const second = (await app.inject({ method: 'POST', url: STATE_URL })).json<StateBody>();

    expect(second.id).toBe(first.id);
    expect(['queued', 'running']).toContain(second.status);

    runner.release();
    await settle();
    // UN seul appel, jamais deux : c'est la preuve qu'aucun second `pg_dump`
    // n'est parti, et pas seulement que la réponse a répété le même identifiant.
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

  /**
   * Un redéploiement en plein export laisse un `.sql.gz` que plus aucune ligne
   * d'état ne désigne : personne ne le sert, personne ne le détruit, et il
   * contient la base entière. La demande suivante est le seul moment où l'on
   * sait qu'aucun export n'est légitimement ouvert.
   */
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

  /**
   * LE verrou qui compte le plus après le rôle : le fichier ne survit pas à sa
   * livraison. Dans le cas nominal, la copie complète de la clientèle vit
   * quelques minutes sur le disque, pas six heures.
   */
  it('détruit le fichier une fois le téléchargement terminé', async () => {
    await app.inject({ method: 'POST', url: STATE_URL });
    await settle();
    expect(await files()).toHaveLength(1);

    await app.inject({ method: 'GET', url: DOWNLOAD_URL });
    // La destruction suit la fin de la réponse : on laisse le tour de boucle
    // se terminer, comme le ferait un navigateur qui referme la connexion.
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

  /**
   * La base annonce un fichier que le disque n'a plus (volume remplacé,
   * effacement manuel). L'écran ne doit pas proposer indéfiniment un
   * téléchargement impossible.
   */
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
  /**
   * Un export prêt dont l'échéance est passée doit être DÉTRUIT au premier
   * regard, et non seulement déclaré échu. Un service qui se contenterait de
   * changer l'étiquette laisserait la base entière sur le volume.
   */
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

  /**
   * Un `running` que plus rien ne fera avancer bloquerait TOUTE nouvelle
   * demande. C'est le scénario du redéploiement en plein export.
   */
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
  /**
   * L'avis passe par le service de notification EXISTANT : il alimente à la
   * fois la cloche du panel et Brevo. Écrire un second expéditeur ici
   * dupliquerait le découpage en lots, la classification des échecs et le mode
   * dégradé sans clé.
   */
  it('prévient l’administrateur qui a demandé l’export', async () => {
    await app.inject({ method: 'POST', url: STATE_URL });
    await settle();

    expect(notifications.sent).toHaveLength(1);
    expect(notifications.sent[0]?.audienceUserIds).toEqual([
      '0199a000-0000-7000-8000-000000000001',
    ]);
  });

  /**
   * AUCUN LIEN NE VOYAGE. C'est la décision de conception la plus importante
   * du module : une boîte aux lettres compromise ou un message transféré ne
   * doit donner accès à rien. Le test lit le corps du message et refuse toute
   * URL.
   */
  it('n’écrit AUCUN lien ni jeton dans le message', async () => {
    await app.inject({ method: 'POST', url: STATE_URL });
    await settle();

    const message = `${notifications.sent[0]?.title ?? ''} ${notifications.sent[0]?.body ?? ''}`;
    expect(message).not.toMatch(/https?:\/\//u);
    expect(message).not.toContain('/api/');
    expect(message).not.toContain('token');
  });

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * L'AVIS N'EST QUE LA CLOCHE, ET L'ÉTAT NE PRÉTEND PLUS AUTRE CHOSE
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * Ce test épinglait `NOT_CONFIGURED`, c'est-à-dire l'issue du TRANSPORT
   * e-mail, comme si cet avis en empruntait un. Il n'en emprunte aucun : la
   * sélection des destinataires d'e-mail ne retient que les comptes COMMERCIAL,
   * et le demandeur d'un export est toujours un ADMIN. Aucun e-mail n'est donc
   * jamais tenté, et l'état recopiait pourtant `SENT`, que l'écran présentait
   * comme « l'e-mail est parti ».
   *
   * La conséquence n'était pas cosmétique : l'administrateur attend un message
   * qui ne viendra pas, conclut à une panne, et relance l'export, ce qui remet
   * un exemplaire complet de la clientèle sur le disque.
   *
   * L'issue est donc `INBOX_ONLY`, QUOI QUE dise le transport : le test le
   * vérifie précisément en posant une valeur de transport qui, autrefois,
   * traversait jusqu'à l'écran.
   */
  it('n’annonce que la cloche, quoi que dise le transport e-mail', async () => {
    notifications.transportStatus = 'NOT_CONFIGURED';

    await app.inject({ method: 'POST', url: STATE_URL });
    const body = await settle();

    expect(body.status).toBe('ready');
    expect(body.downloadable).toBe(true);
    expect(body.noticeStatus).toBe('INBOX_ONLY');
    expect(body.noticeStatus).not.toBe('SENT');
    // L'avis a bien été déposé, lui : la cloche fonctionne réellement.
    expect(notifications.sent).toHaveLength(1);
    expect(notifications.sent[0]?.audienceUserIds).toEqual([
      '0199a000-0000-7000-8000-000000000001',
    ]);
  });

  /**
   * Et la carte ne doit pas non plus promettre un e-mail : le corps de l'avis
   * dit où aller, pas d'attendre un message. Il n'y a rien à attendre.
   */
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
