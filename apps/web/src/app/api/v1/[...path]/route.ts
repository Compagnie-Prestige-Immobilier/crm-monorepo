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

/**
 * Relais `/api/v1/*` — la seule voie par laquelle le navigateur atteint NestJS.
 *
 * Raison d'être : le jeton d'accès vit dans un cookie `httpOnly`. Le JavaScript
 * de la page ne peut donc pas poser l'en-tête `Authorization`, et un appel
 * direct au backend partirait anonyme. Le client généré tourne pourtant bien
 * dans le navigateur — il vise simplement l'origine de Next, et c'est ici que
 * le jeton est rattaché.
 *
 * Bénéfice qui n'est pas un effet de bord : le panel n'a aucun besoin de CORS,
 * et l'API n'a pas à autoriser une origine de navigateur.
 *
 * Le relais est aussi le seul endroit où la ROTATION du refresh token peut
 * aboutir : un Route Handler peut réécrire les cookies de la réponse, ce qu'un
 * rendu de composant serveur ne peut pas faire (les en-têtes sont déjà partis).
 */

/** Les seules méthodes que le panel émet. Le reste n'a pas à être relayé. */
type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/**
 * En-têtes recopiés vers l'amont. Liste blanche : relayer `cookie` enverrait
 * le jeton de session de Next à NestJS, et relayer `host` casserait le routage.
 */
const FORWARDED_REQUEST_HEADERS = ['content-type', 'accept', 'accept-language'];

/** En-têtes recopiés vers le navigateur. */
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'content-disposition', 'content-length'];

function buildUpstreamUrl(segments: string[], search: string): string {
  // `encodeURIComponent` par segment : un identifiant tordu ne doit pas pouvoir
  // sortir du chemin `/api/v1/…` et frapper un autre endpoint.
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
  // Aucune réponse de données ne doit être mise en cache par un intermédiaire :
  // elles sont toutes propres à une session administrateur.
  headers.set('Cache-Control', 'no-store');

  return new Response(upstream.body, { status: upstream.status, headers });
}

async function handle(
  request: Request,
  method: Method,
  context: { params: Promise<{ path: string[] }> },
): Promise<Response> {
  const { path } = await context.params;

  /**
   * La configuration est vérifiée AVANT tout le reste.
   *
   * Sans cette garde, l'absence d'`API_URL` faisait lever `serverApiOrigin()`
   * au fond de `forward()`, où le `catch` la confondait avec un backend
   * injoignable : le panel répondait « Le serveur CPI est injoignable » et
   * envoyait chercher une panne de réseau qui n'existait pas.
   */
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

  // Le corps est lu UNE fois puis conservé : il faut pouvoir le rejouer après
  // une rotation de jeton, et un `ReadableStream` déjà consommé ne se rejoue
  // pas. Les corps du panel sont de petits JSON, jamais des téléversements.
  const body = method === 'GET' || method === 'DELETE' ? null : await request.arrayBuffer();

  let upstream: Response;
  try {
    upstream = await forward(request, method, path, accessToken, body);
  } catch {
    return NextResponse.json({ error: 'Le serveur CPI est injoignable.' }, { status: 502 });
  }

  if (upstream.status !== 401) return toClientResponse(upstream);

  // 401 : le jeton d'accès a expiré. On tourne le refresh token UNE fois et on
  // rejoue. Sans ce rejeu, l'utilisateur serait déconnecté toutes les quinze
  // minutes alors que son refresh token vaut trente jours.
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
    return toClientResponse(await forward(request, method, path, rotation.tokens.accessToken, body));
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
