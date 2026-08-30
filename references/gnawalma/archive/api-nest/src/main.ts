import { NestFactory } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { FastifyAdapter } from '@nestjs/platform-fastify';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import multipart from '@fastify/multipart';
import { AppModule } from './app.module';
import { ProblemDetailsFilter } from './common/problem-details.filter';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      logger: true,
      trustProxy: true,
      bodyLimit: 1_048_576,
      connectionTimeout: 15_000,
      requestIdHeader: 'x-request-id',
      genReqId: () => randomUUID(),
    }),
  );
  const origins = (process.env.CORS_ORIGINS ?? '').split(',').filter(Boolean);
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, { origin: origins.length ? origins : false, credentials: true });
  // Les photos d'atelier sont le seul corps de requête qui dépasse le
  // `bodyLimit` global d'un mégaoctet ; la limite vit ici, pas dans le limiteur
  // général, pour que le reste de l'API reste borné à 1 Mio.
  await app.register(multipart, { limits: { fileSize: 4 * 1024 * 1024, files: 1 } });
  await app.register(rateLimit, {
    max: Number(process.env.RATELIMIT_MAX ?? 100),
    timeWindow: Number(process.env.RATELIMIT_WINDOW_MS ?? 60_000),
  });
  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new ProblemDetailsFilter());
  await app.listen({ port: Number(process.env.PORT ?? 3000), host: '0.0.0.0' });
}

void bootstrap();
