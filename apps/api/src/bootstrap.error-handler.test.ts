import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';

/**
 * AUCUN import statique de `bootstrap.js` ici, et c'est délibéré : il entraîne
 * `app.module.ts`, qui lit l'environnement AU CHARGEMENT. Un import statique
 * serait évalué avant la première ligne de ce fichier, donc avant que les
 * variables ci-dessous ne soient posées, et la suite échouerait sur la
 * validation d'environnement au lieu de tester quoi que ce soit.
 */
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(40);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(40);
process.env.API_DOCS_ENABLED = 'false';

let bodyLimit: number;

/**
 * LES ERREURS QUI N'ATTEIGNENT JAMAIS UN FILTRE NEST.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI IL FAUT DÉMARRER L'APPLICATION POUR TESTER ÇA
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Trois refus sont produits par Fastify lui-même, hors du cycle Nest : 413 sur
 * `bodyLimit` pendant la lecture du corps, 429 sur le crochet `onRequest` du
 * limiteur de débit, 416 sur les plages. Aucun filtre Nest ne les voit ; c'est
 * le gestionnaire posé par `createApiApp()` qui les met à la forme
 * `ApiErrorDto`, dont les trois champs sont annoncés TOUJOURS présents à tous
 * les clients générés.
 *
 * Rien ne le vérifiait. `normalize.test.ts` éprouve la fonction pure, et
 * `prisma-exception.filter.test.ts` remplace `super.catch` par une doublure :
 * ni l'un ni l'autre ne regarde le corps RÉELLEMENT émis sur le fil, qui est
 * pourtant la seule chose que le client voit.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CE QUE CE TEST A SERVI À RÉFUTER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Une relecture a soutenu que ce gestionnaire ne tournait JAMAIS, Nest posant
 * le sien pendant `app.init()`, déclenché par `app.listen()` donc après le
 * retour de `createApiApp()`. C'est FAUX pour cette version : instrumenté avec
 * `process.stderr.write`, le gestionnaire tourne bel et bien, et retirer le
 * bloc fait immédiatement rougir le premier test ci-dessous.
 *
 * La méfiance était justifiée, la conclusion non. Ce test est ce qui tranche,
 * et il tranchera encore le jour où une montée de version de Nest changera
 * réellement l'ordre d'enregistrement.
 */

interface ErrorBody {
  statusCode?: unknown;
  code?: unknown;
  message?: unknown;
  requestId?: unknown;
}

let app: NestFastifyApplication;

beforeAll(async () => {
  const { createApiApp, REQUEST_BODY_LIMIT_BYTES } = await import('./bootstrap.js');
  bodyLimit = REQUEST_BODY_LIMIT_BYTES;
  app = await createApiApp();

  // `listen()` n'est PAS appelé : il ouvrirait une socket et exigerait une
  // base. `init()` suffit, et c'est justement lui qui enregistre le
  // gestionnaire de Nest, donc lui qui reproduit le défaut.
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
}, 60_000);

afterAll(async () => {
  await app.close();
});

describe('normalisation des erreurs émises par Fastify lui-même', () => {
  it('UN 413 SORT À LA FORME ApiErrorDto, avec code et requestId', async () => {
    // Un corps au-delà de `bodyLimit` : Fastify refuse pendant la LECTURE, donc
    // avant tout contrôleur, tout tuyau et tout filtre Nest.
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: 'x'.repeat(bodyLimit + 1_024),
    });

    expect(response.statusCode).toBe(413);

    const body = response.json<ErrorBody>();
    // Les trois champs qu'`ApiErrorDto` promet TOUJOURS présents. Sans eux, un
    // client qui branche sur `code` reçoit `undefined` sur l'erreur même qu'il
    // doit traiter automatiquement, ici « réduis ton lot ».
    expect(body.statusCode).toBe(413);
    expect(typeof body.code).toBe('string');
    expect(body.code).not.toBe('');
    expect(typeof body.message).toBe('string');
    expect(typeof body.requestId).toBe('string');
  });

  it('et le 404 de Nest garde la même forme, il n’a pas été emporté', async () => {
    // Le remède ne doit pas déloger le gestionnaire de Nest : c'est lui qui
    // rend les erreurs des contrôleurs, c'est-à-dire l'immense majorité.
    const response = await app.inject({ method: 'GET', url: '/api/v1/nexistepas' });

    expect(response.statusCode).toBe(404);
    const body = response.json<ErrorBody>();
    expect(typeof body.code).toBe('string');
    expect(typeof body.requestId).toBe('string');
  });
});
