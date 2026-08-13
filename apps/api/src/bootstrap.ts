import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';

import { ValidationPipe, VersioningType } from '@nestjs/common';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { Logger } from 'nestjs-pino';
import multipart from '@fastify/multipart';

import { AppModule } from './app.module.js';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter.js';
import { readEnv, type ApiEnv } from './env.js';

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
      .setTitle('CPI GO — API CRM Prospection')
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
    exposedHeaders: ['Idempotency-Replayed', 'Retry-After', 'Content-Disposition'],
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
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter(app.get(HttpAdapterHost).httpAdapter));
  app.enableShutdownHooks();

  if (env.API_DOCS_ENABLED) {
    const document = buildOpenApiDocument(app);
    SwaggerModule.setup('api/docs', app, document);
    app.getHttpAdapter().get('/api/openapi.json', (_request, reply) => reply.send(document));
  }

  return app;
}
