import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

import { BadRequestException, ValidationPipe, VersioningType } from '@nestjs/common';
import type { ValidationError } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { Logger } from 'nestjs-pino';
import multipart from '@fastify/multipart';

import { AppModule } from './app.module.js';
import { DEMO_MODE_HEADER } from './modules/export/demo-marking.js';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter.js';
import { normalizeErrorBody } from './common/errors/normalize.js';
import { readEnv, type ApiEnv } from './env.js';

/** Le strict nécessaire de la réponse Fastify, pour ne pas dépendre de ses génériques. */
interface FastifyErrorReply {
  code: (status: number) => { send: (payload: unknown) => unknown };
}

/**
 * Aplatit l'arbre des refus de validation en une liste de phrases.
 *
 * `class-validator` rend un ARBRE : un objet imbriqué refusé porte ses propres
 * refus dans `children`. La fabrique par défaut de Nest ne descend pas dedans,
 * si bien qu'un corps de synchronisation refusé au deuxième niveau rendait un
 * message vide et un client sans la moindre piste.
 */
function flattenValidationErrors(errors: ValidationError[], path = ''): string[] {
  return errors.flatMap((error) => {
    const here = path ? `${path}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {});
    const nested = flattenValidationErrors(error.children ?? [], here);
    return [...own, ...nested];
  });
}

/** Un lot de synchronisation de 200 opérations tient largement dedans. */
export const REQUEST_BODY_LIMIT_BYTES = 4_194_304;

/**
 * Document OpenAPI.
 *
 * STRICTEMENT DÉTERMINISTE : version figée en dur, aucune date, aucun SHA de
 * commit, rien qui change d'une exécution à l'autre. Le contrôle de dérive en
 * intégration continue régénère le fichier et compare octet à octet ; la
 * moindre valeur variable le ferait échouer à chaque exécution et l'équipe
 * finirait par le désactiver.
 */
export const buildOpenApiDocument = (app: NestFastifyApplication): OpenAPIObject =>
  SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('CPI GO, API CRM Prospection')
      .setDescription(
        'API du CRM de prospection CPI : saisie terrain hors ligne, synchronisation idempotente, panel administrateur.',
      )
      .setVersion('1.0.0')
      .addBearerAuth()
      .build(),
  );

export function createApiAdapter(env: ApiEnv): FastifyAdapter {
  return new FastifyAdapter({
    trustProxy: env.API_TRUST_PROXY_HEADERS,
    bodyLimit: REQUEST_BODY_LIMIT_BYTES,
    // Un identifiant de requête fourni par le client est recopié dans chaque
    // ligne de journal : on le contraint plutôt que d'accepter du texte libre.
    genReqId: (request: IncomingMessage) => {
      const supplied = request.headers['x-request-id']?.toString();
      return supplied && /^[\w-]{1,64}$/.test(supplied) ? supplied : randomUUID();
    },
  });
}

export async function createApiApp(): Promise<NestFastifyApplication> {
  const env = readEnv();
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, createApiAdapter(env), {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  // Swagger UI a besoin de styles et de scripts en ligne ; la CSP par défaut
  // de helmet les bloque et l'interface s'affiche vide. On ne la désarme que
  // là où la documentation est effectivement servie.
  await app.register(helmet, env.API_DOCS_ENABLED ? { contentSecurityPolicy: false } : {});
  await app.register(rateLimit, { max: 600, timeWindow: '1 minute' });
  await app.register(multipart, {
    limits: { fileSize: env.APK_MAX_SIZE_BYTES, files: 1, fields: 8 },
  });
  // Enregistré dans tous les environnements : c'est la liste blanche qui est le
  // contrôle, pas l'environnement.
  await app.register(cors, {
    origin: env.API_CORS_ORIGINS,
    credentials: true,
    // `X-Demo-Mode` doit être EXPOSÉ, sinon le navigateur le reçoit et le cache
    // au code de l'application : la bannière ne pourrait pas confirmer qu'un
    // fichier tout juste téléchargé porte bien des lignes fictives.
    exposedHeaders: [
      'Idempotency-Replayed',
      'Retry-After',
      'Content-Disposition',
      DEMO_MODE_HEADER,
    ],
  });

  // Les sondes restent hors préfixe et hors version : l'orchestrateur doit
  // pouvoir viser des chemins qui ne bougeront jamais.
  app.setGlobalPrefix('api', { exclude: ['health/live', 'health/ready'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1', prefix: 'v' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      // Un champ inconnu est refusé et non ignoré : côté mobile, une faute de
      // frappe sur un nom de champ produirait sinon un enregistrement
      // silencieusement incomplet.
      forbidNonWhitelisted: true,
      transform: true,
      // Le refus de validation porte un CODE, comme toutes les autres erreurs.
      // Sans cette fabrique, Nest rend `{ statusCode, message: [...], error }` :
      // pas de `code` sur lequel brancher, et un `message` TABLEAU là où il est
      // une chaîne partout ailleurs. Le filtre global range ensuite le tableau
      // dans `details` (voir `common/errors/normalize.ts`).
      exceptionFactory: (errors) =>
        new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: flattenValidationErrors(errors),
        }),
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter(app.get(HttpAdapterHost).httpAdapter));

  // Les erreurs qui n'atteignent JAMAIS un filtre Nest.
  //
  // Trois refus sont produits par Fastify lui même, avant ou en dehors du
  // gestionnaire Nest, et échappaient donc à la normalisation du filtre global :
  //
  //   · 429, levé par le crochet `onRequest` de @fastify/rate-limit ;
  //   · 413, levé par `bodyLimit` pendant la lecture du corps ;
  //   · 416, levé par @fastify/static à l'intérieur du tuyau de réponse.
  //
  // Ils sortaient sous la forme de Fastify, `{ statusCode, error, message }`,
  // c'est à dire SANS `code`. Un client qui branche sur `code` recevait
  // `undefined` exactement sur les trois erreurs qu'il doit traiter
  // automatiquement (attendre, réduire le lot, redemander la plage).
  app
    .getHttpAdapter()
    .getInstance()
    .setErrorHandler(
      (
        error: unknown,
        request: { id?: unknown; log?: { error: (...args: unknown[]) => void } },
        reply: FastifyErrorReply,
      ) => {
        const shaped = error as { statusCode?: unknown; message?: unknown };
        const status = typeof shaped.statusCode === 'number' ? shaped.statusCode : 500;
        const requestId = typeof request.id === 'string' ? request.id : undefined;
        const message = typeof shaped.message === 'string' ? shaped.message : undefined;

        // Poser ce gestionnaire REMPLACE celui de Fastify, qui journalisait
        // lui-même. Sans cette ligne, tout ce qui n'atteint pas un filtre Nest
        // (erreurs de greffon, de hook, de sérialisation, 413, 416, 429) partait
        // au client sans laisser LA MOINDRE trace côté serveur : une panne de
        // production devenait invisible dans les journaux.
        //
        // ON NE JOURNALISE PAS L'OBJET D'ERREUR BRUT.
        //
        // La censure de pino porte sur la requête et sur des clés de premier
        // niveau (`password`, `*.token`…). Une erreur venue d'un client HTTP
        // transporte volontiers un `config.headers.authorization`, soit trois
        // niveaux plus bas : elle passerait donc en clair dans le journal. On
        // ne retient que ce qui sert au diagnostic et qui ne peut rien porter
        // de secret : le nom, le message déjà rendu au client, et la pile.
        const named = error as { name?: unknown; stack?: unknown };
        request.log?.error(
          {
            status,
            err: {
              name: typeof named.name === 'string' ? named.name : 'Error',
              message: message ?? 'erreur sans message',
              stack: typeof named.stack === 'string' ? named.stack : undefined,
            },
          },
          'requête terminée en erreur',
        );

        void reply.code(status).send(normalizeErrorBody(status, { message }, requestId));
      },
    );
  app.enableShutdownHooks();

  if (env.API_DOCS_ENABLED) {
    const document = buildOpenApiDocument(app);
    SwaggerModule.setup('api/docs', app, document);
    app.getHttpAdapter().get('/api/openapi.json', (_request, reply) => reply.send(document));
  }

  return app;
}
