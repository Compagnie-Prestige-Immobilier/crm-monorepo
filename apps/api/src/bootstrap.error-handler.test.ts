import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { NestFastifyApplication } from '@nestjs/platform-fastify';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ??= 'postgresql://crm:crm@localhost:5434/crm';
process.env.JWT_ACCESS_SECRET = 'a'.repeat(40);
process.env.JWT_REFRESH_SECRET = 'b'.repeat(40);
process.env.API_DOCS_ENABLED = 'false';

let bodyLimit: number;

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

  await app.init();
  await app.getHttpAdapter().getInstance().ready();
}, 60_000);

afterAll(async () => {
  await app.close();
});

describe('normalisation des erreurs émises par Fastify lui-même', () => {
  it('UN 413 SORT À LA FORME ApiErrorDto, avec code et requestId', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: 'x'.repeat(bodyLimit + 1_024),
    });

    expect(response.statusCode).toBe(413);

    const body = response.json<ErrorBody>();
    expect(body.statusCode).toBe(413);
    expect(typeof body.code).toBe('string');
    expect(body.code).not.toBe('');
    expect(typeof body.message).toBe('string');
    expect(typeof body.requestId).toBe('string');
  });

  it('et le 404 de Nest garde la même forme, il n’a pas été emporté', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/v1/nexistepas' });

    expect(response.statusCode).toBe(404);
    const body = response.json<ErrorBody>();
    expect(typeof body.code).toBe('string');
    expect(typeof body.requestId).toBe('string');
  });
});
