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
import { isAccessTokenStale, rotateRefreshTokenDetailed } from '@/lib/api/tokens';

const UNREACHABLE = { error: 'Le serveur CPI est injoignable.' };

const UPSTREAM = `${API_PREFIX}/app-updates/android`;

type Session = { ok: true; accessToken: string } | { ok: false; response: Response };

/**
 * Le corps de cette requête est un flux de 85 Mo : il ne peut être ni gardé en
 * mémoire ni rejoué. Le jeton se rafraîchit donc AVANT l'envoi, et non après un
 * 401 comme le fait le relais générique.
 */
async function freshAccessToken(): Promise<Session> {
  const accessToken = await getAccessToken();
  if (accessToken === null || accessToken === '') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Session expirée.' }, { status: 401 }),
    };
  }
  if (!isAccessTokenStale(accessToken)) return { ok: true, accessToken };

  const refreshToken = await getRefreshToken();
  const rotation =
    refreshToken === null || refreshToken === ''
      ? { ok: false as const, reason: 'invalid' as const }
      : await rotateRefreshTokenDetailed(serverApiOrigin(), refreshToken);

  if (!rotation.ok && rotation.reason === 'unavailable') {
    return { ok: false, response: NextResponse.json(UNREACHABLE, { status: 502 }) };
  }

  if (!rotation.ok) {
    await clearSessionCookies();
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Session expirée. Reconnectez-vous.', code: 'SESSION_EXPIRED' },
        { status: 401 },
      ),
    };
  }

  await setSessionCookies(toAuthTokens(rotation.tokens));
  return { ok: true, accessToken: rotation.tokens.accessToken };
}

export async function POST(request: Request): Promise<Response> {
  try {
    serverApiOrigin();
  } catch (error) {
    if (error instanceof ApiConfigurationError) {
      return NextResponse.json(configErrorBody(error), { status: 500 });
    }
    throw error;
  }

  const session = await freshAccessToken();
  if (!session.ok) return session.response;

  const headers = new Headers({
    Authorization: `Bearer ${session.accessToken}`,
    Accept: 'application/json',
  });
  const contentType = request.headers.get('content-type');
  if (contentType !== null) headers.set('Content-Type', contentType);

  let upstream: Response;
  try {
    upstream = await fetch(`${serverApiOrigin()}${UPSTREAM}`, {
      method: 'POST',
      headers,
      body: request.body,
      duplex: 'half',
      cache: 'no-store',
      redirect: 'manual',
    } as RequestInit & { duplex: 'half' });
  } catch {
    return NextResponse.json(UNREACHABLE, { status: 502 });
  }

  const responseHeaders = new Headers({ 'Cache-Control': 'no-store' });
  const upstreamType = upstream.headers.get('content-type');
  if (upstreamType !== null) responseHeaders.set('Content-Type', upstreamType);

  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}
