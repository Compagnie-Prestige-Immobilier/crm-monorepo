import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { envSchema } from '../../env.js';
import {
  createDumpApp,
  FakeDumpRunner,
  FakeDumpStore,
  FakeNotifications,
} from './fake-dump-store.js';

/**
 * L'INTERRUPTEUR. `DB_DUMP_ENABLED` absent veut dire « il n'y a pas de porte ».
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUE CE FICHIER GARDE, ET POURQUOI IL EST SÉPARÉ DES AUTRES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Tous les autres fichiers d'essai du module allument l'interrupteur dans leur
 * `beforeEach`, parce qu'ils éprouvent ce que la fonctionnalité FAIT. Celui-ci
 * éprouve ce qu'elle ne fait pas, et c'est la propriété la plus chère du lot :
 * un déploiement qui ne pose pas la variable ne doit servir AUCUNE des trois
 * routes, et surtout ne doit pas lancer de `pg_dump`.
 *
 * Le défaut est vérifié SUR LE SCHÉMA lui-même, et pas seulement à travers une
 * requête : « éteint par défaut » est une propriété de `env.ts`, et un
 * `.default('true')` posé un jour par commodité doit faire rougir un test ici,
 * pas se découvrir en production.
 */

const STATE_URL = '/api/v1/admin/database-dump';
const DOWNLOAD_URL = '/api/v1/admin/database-dump/download';

let app: NestFastifyApplication;
let store: FakeDumpStore;
let runner: FakeDumpRunner;

beforeAll(() => {
  process.env.NODE_ENV ??= 'test';
  process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm?schema=public';
  process.env.JWT_ACCESS_SECRET ??= 'db-dump-access-secret-32-characters-x';
  process.env.JWT_REFRESH_SECRET ??= 'db-dump-refresh-secret-32-characters-x';
});

beforeEach(async () => {
  process.env.DB_DUMP_DIR = await mkdtemp(join(tmpdir(), 'cpi-dumps-flag-'));
  store = new FakeDumpStore();
  runner = new FakeDumpRunner();
  app = await createDumpApp({ store, runner, notifications: new FakeNotifications() });
});

afterEach(async () => {
  await app.close();
  delete process.env.DB_DUMP_ENABLED;
});

describe('interrupteur DB_DUMP_ENABLED', () => {
  /**
   * LE test de ce fichier. Un environnement qui ne dit rien doit produire une
   * API sans export intégral : c'est ce que voit un déploiement fait
   * aujourd'hui, sans que personne n'ait rien décidé.
   */
  it('est éteint quand l’environnement ne dit rien', () => {
    const env = envSchema.parse({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://crm:crm@localhost:5434/crm?schema=public',
      JWT_ACCESS_SECRET: 'db-dump-access-secret-32-characters-x',
      JWT_REFRESH_SECRET: 'db-dump-refresh-secret-32-characters-x',
    });
    expect(env.DB_DUMP_ENABLED).toBe(false);
  });

  it('n’allume pas la fonctionnalité sur la chaîne « false »', () => {
    const env = envSchema.parse({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://crm:crm@localhost:5434/crm?schema=public',
      JWT_ACCESS_SECRET: 'db-dump-access-secret-32-characters-x',
      JWT_REFRESH_SECRET: 'db-dump-refresh-secret-32-characters-x',
      DB_DUMP_ENABLED: 'false',
    });
    expect(env.DB_DUMP_ENABLED).toBe(false);
  });

  describe('éteint', () => {
    beforeEach(() => {
      delete process.env.DB_DUMP_ENABLED;
    });

    it('rend 404 sur l’état, la demande et le téléchargement', async () => {
      for (const [method, url] of [
        ['GET', STATE_URL],
        ['POST', STATE_URL],
        ['GET', DOWNLOAD_URL],
      ] as const) {
        const response = await app.inject({ method, url });
        expect(response.statusCode, `${method} ${url}`).toBe(404);
        expect(response.json<{ code: string }>().code).toBe('DATABASE_DUMP_DISABLED');
      }
    });

    /**
     * Le 404 doit tomber AVANT le service. Un refus posé après coup laisserait
     * partir le `pg_dump` et n'aurait fait que cacher la réponse.
     */
    it('ne lance aucun pg_dump et n’écrit aucun état', async () => {
      await app.inject({ method: 'POST', url: STATE_URL });

      expect(runner.calls).toBe(0);
      expect(store.stored()).toBeNull();
      expect(store.audits).toHaveLength(0);
    });
  });

  /**
   * Contre-épreuve. Sans elle, un contrôleur qui refuserait TOUT ferait passer
   * la totalité de ce fichier sans rien prouver.
   */
  describe('allumé', () => {
    beforeEach(() => {
      process.env.DB_DUMP_ENABLED = 'true';
    });

    it('sert de nouveau l’état et accepte la demande', async () => {
      expect((await app.inject({ method: 'GET', url: STATE_URL })).statusCode).toBe(200);
      expect((await app.inject({ method: 'POST', url: STATE_URL })).statusCode).toBe(202);
    });
  });
});
