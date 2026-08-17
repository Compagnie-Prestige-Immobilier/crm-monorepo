import { NextResponse } from 'next/server';

import {
  API_PREFIX,
  ApiConfigurationError,
  configErrorBody,
  serverApiOrigin,
} from '@/lib/api/config';
import {
  clearSessionCookies,
  getAccessToken,
  getRefreshToken,
  setSessionCookies,
  toAuthTokens,
} from '@/lib/api/server';
import { rotateRefreshTokenDetailed } from '@/lib/api/tokens';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

// `idempotency-key` : sans elle, `POST /sync/push` repart en 422 IDEMPOTENCY_KEY_REQUIRED.
const FORWARDED_REQUEST_HEADERS = ['content-type', 'accept', 'accept-language', 'idempotency-key'];

const FORWARDED_RESPONSE_HEADERS = [
  'content-type',
  'content-disposition',
  'content-length',
  'x-demo-mode',
];

function buildUpstreamUrl(segments: string[], search: string): string {
  const path = segments.map((segment) => encodeURIComponent(segment)).join('/');
  return `${serverApiOrigin()}${API_PREFIX}/${path}${search}`;
}

async function forward(
  request: Request,
  method: Method,
  segments: string[],
  accessToken: string,
  body: ArrayBuffer | null,
): Promise<Response> {
  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  headers.set('Authorization', `Bearer ${accessToken}`);

  const url = new URL(request.url);
  return fetch(buildUpstreamUrl(segments, url.search), {
    method,
    headers,
    ...(body === null || body.byteLength === 0 ? {} : { body }),
    cache: 'no-store',
    redirect: 'manual',
  });
}

function toClientResponse(upstream: Response): Response {
  const headers = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  headers.set('Cache-Control', 'no-store');

  return new Response(upstream.body, { status: upstream.status, headers });
}

async function handle(
  request: Request,
  method: Method,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;

  try {
    serverApiOrigin();
  } catch (error) {
    if (error instanceof ApiConfigurationError) {
      return NextResponse.json(configErrorBody(error), { status: 500 });
    }
    throw error;
  }

  const accessToken = await getAccessToken();
  if (accessToken === null || accessToken === '') {
    return NextResponse.json({ error: 'Session expirée.' }, { status: 401 });
  }

  const body = method === 'GET' || method === 'DELETE' ? null : await request.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await forward(request, method, path, accessToken, body);
  } catch {
    return NextResponse.json({ error: 'Le serveur CPI est injoignable.' }, { status: 502 });
  }

  if (upstream.status !== 401) return toClientResponse(upstream);

  const refreshToken = await getRefreshToken();
  const rotation =
    refreshToken === null || refreshToken === ''
      ? { ok: false as const, reason: 'invalid' as const }
      : await rotateRefreshTokenDetailed(serverApiOrigin(), refreshToken);

  if (!rotation.ok && rotation.reason === 'unavailable') {
    return NextResponse.json({ error: 'Le serveur CPI est injoignable.' }, { status: 502 });
  }

  if (!rotation.ok) {
    await clearSessionCookies();
    return NextResponse.json(
      { error: 'Session expirée. Reconnectez-vous.', code: 'SESSION_EXPIRED' },
      { status: 401 },
    );
  }

  await setSessionCookies(toAuthTokens(rotation.tokens));

  try {
    return toClientResponse(
      await forward(request, method, path, rotation.tokens.accessToken, body),
    );
  } catch {
    return NextResponse.json({ error: 'Le serveur CPI est injoignable.' }, { status: 502 });
  }
}

export const GET = (request: Request, context: { params: Promise<{ path: string[] }> }) =>
  handle(request, 'GET', context);
export const POST = (request: Request, context: { params: Promise<{ path: string[] }> }) =>
  handle(request, 'POST', context);
export const PATCH = (request: Request, context: { params: Promise<{ path: string[] }> }) =>
  handle(request, 'PATCH', context);
export const PUT = (request: Request, context: { params: Promise<{ path: string[] }> }) =>
  handle(request, 'PUT', context);
export const DELETE = (request: Request, context: { params: Promise<{ path: string[] }> }) =>
  handle(request, 'DELETE', context);
