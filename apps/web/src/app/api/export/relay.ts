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
import { DEMO_MODE_HEADER, isDemoResponse, withDemoSuffix } from '@/lib/demo-marking';
import { getSession } from '@/lib/session';
import type { Role } from '@/lib/types';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface XlsxRelayOptions {
  upstreamPath: string;
  search: URLSearchParams;
  filename: string;
  allowedRoles?: readonly Role[] | undefined;
}

async function requestUpstream(options: XlsxRelayOptions, accessToken: string): Promise<Response> {
  const query = options.search.toString();
  const url = `${serverApiOrigin()}${API_PREFIX}/${options.upstreamPath}${query === '' ? '' : `?${query}`}`;
  return fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: XLSX_MIME },
    cache: 'no-store',
  });
}

export async function relayXlsx(options: XlsxRelayOptions): Promise<Response> {
  try {
    serverApiOrigin();
  } catch (error) {
    if (error instanceof ApiConfigurationError) {
      return NextResponse.json(configErrorBody(error), { status: 500 });
    }
    throw error;
  }

  const session = await getSession();
  if (session === null) {
    return NextResponse.json({ error: 'Session expirée.' }, { status: 401 });
  }

  const allowed = options.allowedRoles;
  if (allowed !== undefined && !allowed.includes(session.role)) {
    return NextResponse.json(
      { error: 'Cet export n’est pas accessible avec votre rôle.' },
      { status: 403 },
    );
  }

  const accessToken = await getAccessToken();
  if (accessToken === null || accessToken === '') {
    return NextResponse.json({ error: 'Session expirée.' }, { status: 401 });
  }

  let upstream: Response;
  try {
    upstream = await requestUpstream(options, accessToken);

    if (upstream.status === 401) {
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
      upstream = await requestUpstream(options, rotation.tokens.accessToken);
    }
  } catch {
    return NextResponse.json({ error: 'Le serveur CPI est injoignable.' }, { status: 502 });
  }

  if (!upstream.ok || upstream.body === null) {
    return NextResponse.json(
      { error: `L'export a échoué (code ${String(upstream.status)}).` },
      { status: 502 },
    );
  }

  const demo = isDemoResponse(upstream.headers);

  return new Response(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': XLSX_MIME,
      'Content-Disposition': `attachment; filename="${withDemoSuffix(options.filename, demo)}"`,
      [DEMO_MODE_HEADER]: demo ? 'true' : 'false',
      'Cache-Control': 'no-store',
    },
  });
}

export function toSearchParams(query: Record<string, unknown>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    params.set(key, String(value));
  }
  return params;
}
