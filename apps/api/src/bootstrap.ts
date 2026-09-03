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
import websocket from '@fastify/websocket';

import { AppModule } from './app.module.js';
import { DEMO_MODE_HEADER } from './modules/export/demo-marking.js';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter.js';
import { normalizeErrorBody } from './common/errors/normalize.js';
import { readEnv, type ApiEnv } from './env.js';
import { WorkspaceContext } from './workspaces/workspace.js';
import { PresenceSocketService } from './modules/heartbeat/presence-socket.service.js';

interface FastifyErrorReply {
  code: (status: number) => { send: (payload: unknown) => unknown };
}

function flattenValidationErrors(errors: ValidationError[], path = ''): string[] {
  return errors.flatMap((error) => {
    const here = path ? `${path}.${error.property}` : error.property;
    const own = Object.values(error.constraints ?? {});
    const nested = flattenValidationErrors(error.children ?? [], here);
    return [...own, ...nested];
  });
}

export const REQUEST_BODY_LIMIT_BYTES = 4_194_304;
const requestStartedAt = new WeakMap<object, number>();

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
    genReqId: (request: IncomingMessage) => {
      const supplied = request.headers['x-request-id']?.toString();
      return supplied && /^[\w-]{1,64}$/.test(supplied) ? supplied : randomUUID();
    },
  });
}

export async function createApiApp(): Promise<NestFastifyApplication> {
  const env = readEnv();
  const adapter = createApiAdapter(env);
  await adapter.getInstance().register(websocket, { options: { maxPayload: 64 } });
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));

  const workspace = app.get(WorkspaceContext);
  const httpLogger = app.get(Logger);
  const http = app.getHttpAdapter().getInstance();
  const presence = app.get(PresenceSocketService);
  http.get('/api/v1/presence/live', { websocket: true }, (socket, request) => {
    presence.connect(socket, request.headers);
  });
  http.addHook('onRequest', (request, _reply, done) => {
    requestStartedAt.set(request, Date.now());
    workspace.run(done);
  });
  http.addHook('onResponse', (request, reply, done) => {
    const status = reply.statusCode;
    const details = {
      requestId: request.id,
      method: request.method,
      url: request.url,
      status,
      durationMs: Date.now() - (requestStartedAt.get(request) ?? Date.now()),
    };
    const message = `HTTP ${request.method} ${request.url} -> ${status}`;

    if (status >= 500) httpLogger.error(details, message);
    else if (status >= 400) httpLogger.warn(details, message);
    else httpLogger.log(details, message);
    done();
  });

  await app.register(helmet, env.API_DOCS_ENABLED ? { contentSecurityPolicy: false } : {});
  await app.register(rateLimit, { max: 600, timeWindow: '1 minute' });
  await app.register(multipart, {
    limits: { fileSize: env.APK_MAX_SIZE_BYTES, files: 1, fields: 8 },
  });
  await app.register(cors, {
    origin: env.API_CORS_ORIGINS,
    credentials: true,
    exposedHeaders: [
      'Idempotency-Replayed',
      'Retry-After',
      'Content-Disposition',
      DEMO_MODE_HEADER,
    ],
  });

  app.setGlobalPrefix('api', { exclude: ['health/live', 'health/ready'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1', prefix: 'v' });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      exceptionFactory: (errors) =>
        new BadRequestException({
          code: 'VALIDATION_FAILED',
          message: flattenValidationErrors(errors),
        }),
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter(app.get(HttpAdapterHost).httpAdapter));

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
