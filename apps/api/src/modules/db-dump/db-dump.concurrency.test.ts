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

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * LES COURSES, ET LA VIE DU FICHIER. C'EST ICI QUE LE MODULE SE JOUE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les autres fichiers d'essai exercent le cycle nominal, un appelant à la fois.
 * Celui-ci exerce ce qui arrive quand il y en a DEUX, et ce qui reste sur le
 * disque quand le processus meurt. Ce sont les deux seules façons dont ce
 * module peut laisser sortir un second exemplaire complet de la clientèle, ou
 * en abandonner un sur un volume.
 *
 * TOUTES LES COURSES SONT RÉELLES : deux appels lancés ensemble par
 * `Promise.all`, qui s'entrelacent aux points d'attente comme le feraient deux
 * requêtes HTTP simultanées, ou deux répliques derrière le répartiteur. Deux
 * appels séquentiels ne prouveraient rien : la première écriture serait déjà
 * commise quand le second lit, ce qui est exactement le cas que le code
 * gérait déjà.
 *
 * La doublure d'`app_settings` APPLIQUE les prédicats des écritures
 * conditionnelles et rend le nombre de lignes touchées ; sans cela ces tests
 * passeraient contre un verrou inexistant.
 */

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

// ─────────────────────────────────────────────────────────────────────────────
// UN SEUL pg_dump
// ─────────────────────────────────────────────────────────────────────────────

describe('deux demandes simultanées', () => {
  /**
   * LE test de l'unicité. Le verrou était un booléen `private starting`, donc
   * local au processus : sur deux répliques, les deux lisaient « aucun export
   * en cours », les deux le passaient, et DEUX `pg_dump` partaient sur la même
   * base. Le second écrasait l'état du premier, dont l'archive devenait un
   * orphelin que plus rien ne nommait, ni pour la servir ni pour la détruire.
   *
   * L'entrelacement est réel : les deux requêtes sont lancées ensemble et
   * lisent toutes deux l'absence de ligne avant que l'une n'écrive.
   */
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

    // LA propriété : un seul appel au lanceur, une seule archive sur le volume.
    expect(runner.calls).toBe(1);
    expect(await files()).toHaveLength(1);
  });

  /**
   * La même course, mais avec une ligne DÉJÀ présente : le chemin de la
   * comparaison-et-échange, et non celui de l'insertion. Les deux doivent
   * arbitrer, et pour des raisons différentes : l'insertion s'appuie sur la clé
   * primaire, la mise à jour sur le prédicat de valeur.
   */
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

  /**
   * Une archive PRÊTE n'est plus détruite par une demande suivante.
   *
   * L'ancien comportement effaçait le fichier et repartait pour plusieurs
   * minutes : l'administrateur qui téléchargeait au même instant voyait son
   * transfert mourir, et celui qui recliquait par réflexe perdait un export
   * déjà produit et déjà annoncé.
   */
  it('refuse une nouvelle demande tant qu’une archive est prête, sans y toucher', async () => {
    await app.inject({ method: 'POST', url: STATE_URL });
    await settle();
    const before = await files();
    expect(before).toHaveLength(1);

    const again = await app.inject({ method: 'POST', url: STATE_URL });

    expect(again.statusCode).toBe(409);
    expect(again.json<{ code: string }>().code).toBe('DATABASE_DUMP_ALREADY_READY');
    expect(runner.calls).toBe(1);
    // L'archive est INTACTE, jusqu'au nom.
    expect(await files()).toEqual(before);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UNE SEULE LIVRAISON
// ─────────────────────────────────────────────────────────────────────────────

describe('deux téléchargements simultanés', () => {
  /**
   * LE test de la livraison unique. Les deux requêtes passaient le contrôle
   * `ready` et recevaient toutes deux l'archive intégrale : la destruction
   * après envoi, qui n'a lieu qu'à la fin, arrivait trop tard pour empêcher
   * quoi que ce soit. Deux exemplaires complets de la clientèle sortaient d'une
   * fonctionnalité écrite pour n'en laisser sortir qu'un.
   */
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
    // Et l'unique servi porte bien l'archive, pas une réponse vide.
    expect(served[0]?.rawPayload.length).toBeGreaterThan(0);
  });

  /**
   * L'en-tête de démonstration est posé à `false` sur le téléchargement.
   *
   * Sans lui, `DemoModeInterceptor` estampille `X-Demo-Mode: true` pendant une
   * démonstration et le panel enregistre le fichier sous « …-DEMONSTRATION ».
   * L'archive contient pourtant la base RÉELLE, puisqu'elle a nécessairement
   * été produite hors démonstration. Un fichier réel pris pour un jouet est un
   * fichier que plus personne ne protège.
   */
  it('affirme que l’archive n’est pas une démonstration', async () => {
    await app.inject({ method: 'POST', url: STATE_URL });
    await settle();

    const response = await app.inject({ method: 'GET', url: DOWNLOAD_URL });

    expect(response.statusCode).toBe(200);
    expect(response.headers['x-demo-mode']).toBe('false');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// UN HEAD NE CONSOMME RIEN
// ─────────────────────────────────────────────────────────────────────────────

describe('requête HEAD sur le téléchargement', () => {
  /**
   * Fastify inscrit un HEAD pour chaque GET, servi par le MÊME gestionnaire.
   * Un `HEAD` authentifié administrateur traversait donc tout le chemin de
   * téléchargement : la trace « téléchargé » était écrite, la réponse
   * s'achevait normalement (`writableFinished` est vrai pour un HEAD), et
   * l'archive était DÉTRUITE sans qu'un octet ne parte. Une sonde de
   * disponibilité ou un préchargement de navigateur suffisait.
   *
   * Le test vérifie d'abord que le HEAD est bien routé, sans quoi il ne
   * prouverait rien.
   */
  it('ne détruit pas l’archive et n’écrit aucune trace', async () => {
    await app.inject({ method: 'POST', url: STATE_URL });
    await settle();
    const before = await files();
    expect(before).toHaveLength(1);

    const head = await app.inject({ method: 'HEAD', url: DOWNLOAD_URL });
    // La route existe bien en HEAD : sans cela le reste du test est vide.
    expect(head.statusCode).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(await files()).toEqual(before);
    expect(store.audits.filter((row) => row.action === 'DATABASE_DUMP_DOWNLOADED')).toHaveLength(0);
    // Et l'archive reste téléchargeable pour de bon.
    expect((await app.inject({ method: 'GET', url: DOWNLOAD_URL })).statusCode).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LE LIEN SYMBOLIQUE
// ─────────────────────────────────────────────────────────────────────────────

describe('lien symbolique déposé dans le répertoire', () => {
  /**
   * `basename` empêche de SORTIR du répertoire par le nom. Il ne dit rien de
   * ce que le nom DÉSIGNE une fois dedans : `stat` et `createReadStream`
   * suivaient les liens. Qui peut écrire sur le volume pouvait donc faire
   * servir n'importe quel fichier local par une route authentifiée
   * administrateur.
   */
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
    // Le fichier visé n'a pas non plus été détruit au passage.
    expect(await readFile(secret, 'utf8')).toBe('clé privée du serveur');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LA VIE DU FICHIER EST BORNÉE
// ─────────────────────────────────────────────────────────────────────────────

describe('réconciliation d’amorçage', () => {
  const service = (): DbDumpService => app.get(DbDumpService);

  /**
   * L'archive partielle laissée par un conteneur tué en plein `pg_dump`.
   * Rien ne l'effaçait : ni l'écran, qui ne regarde que la ligne d'état, ni
   * l'échéance, qui ne porte que sur un `ready`. Elle attendait une éventuelle
   * demande suivante, et restait indéfiniment s'il n'y en avait pas.
   */
  it('efface une archive que plus aucune ligne ne nomme', async () => {
    await writeFile(join(directory, 'cpi-base-20260815T090000-orphelin.sql.gz'), 'partiel');

    await service().sweep(new Date(), true);

    expect(await files()).toEqual([]);
  });

  /**
   * L'archive échue que personne n'a regardée. L'échéance reposait sur un
   * `setTimeout` perdu au redémarrage, doublé d'une application paresseuse au
   * premier regard : un export produit un vendredi soir passait le week-end
   * sur le volume, où passent les instantanés de sauvegarde du fournisseur.
   */
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

  /**
   * Le cas que la destruction non attendue laissait passer : le processus tombe
   * entre la fin de la réponse et l'effacement du fichier. La ligne reste
   * `ready`, DURABLE, et l'archive repasse le redémarrage, téléchargeable.
   *
   * Au démarrage, toute réservation appartient à un processus mort. On ne peut
   * pas savoir si les octets sont arrivés, et le doute penche du côté qui
   * détruit : une seconde livraison d'un exemplaire complet de la clientèle
   * coûte infiniment plus cher qu'un export à relancer.
   */
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
      // Réservée il y a une seconde : le bail n'est PAS écoulé. Seul le fait
      // qu'on démarre prouve que le détenteur est mort.
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

  /**
   * Contre-épreuve, et elle est indispensable : un balayage qui effacerait TOUT
   * ferait passer les trois tests ci-dessus en détruisant aussi les archives
   * parfaitement valides, ce qui casserait la fonctionnalité sans qu'aucun de
   * ces tests ne le dise.
   */
  it('ne touche pas à une archive prête, valide et non réservée', async () => {
    await app.inject({ method: 'POST', url: STATE_URL });
    await settle();
    const before = await files();
    expect(before).toHaveLength(1);

    await service().sweep();

    expect(await files()).toEqual(before);
    expect((await app.inject({ method: 'GET', url: DOWNLOAD_URL })).statusCode).toBe(200);
  });
});
