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
import { DEMO_MODE_HEADER, isDemoExport, withDemoSuffix } from '@/lib/demo-marking';
import { getSession } from '@/lib/session';
import type { Role } from '@/lib/types';

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

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

type Renouvellement = { ok: true; accessToken: string } | { ok: false; reponse: Response };

async function renouvelerSession(): Promise<Renouvellement> {
  const refreshToken = await getRefreshToken();
  const rotation =
    refreshToken === null || refreshToken === ''
      ? { ok: false as const, reason: 'invalid' as const }
      : await rotateRefreshTokenDetailed(serverApiOrigin(), refreshToken);

  if (!rotation.ok && rotation.reason === 'unavailable') {
    return {
      ok: false,
      reponse: NextResponse.json({ error: 'Le serveur CPI est injoignable.' }, { status: 502 }),
    };
  }

  if (!rotation.ok) {
    await clearSessionCookies();
    return {
      ok: false,
      reponse: NextResponse.json(
        { error: 'Session expirée. Reconnectez-vous.', code: 'SESSION_EXPIRED' },
        { status: 401 },
      ),
    };
  }

  await setSessionCookies(toAuthTokens(rotation.tokens));
  return { ok: true, accessToken: rotation.tokens.accessToken };
}

type UpstreamRetryResult = { ok: true; response: Response } | { ok: false; reponse: Response };

async function fetchUpstreamAvecRenouvellement(
  options: XlsxRelayOptions,
  accessToken: string,
): Promise<UpstreamRetryResult> {
  const first = await requestUpstream(options, accessToken);
  if (first.status !== 401) {
    return { ok: true, response: first };
  }

  const renouvelle = await renouvelerSession();
  if (!renouvelle.ok) {
    return { ok: false, reponse: renouvelle.reponse };
  }

  return { ok: true, response: await requestUpstream(options, renouvelle.accessToken) };
}

type ExportAuthResult = { ok: true; accessToken: string } | { ok: false; reponse: Response };

async function resolveExportAuth(options: XlsxRelayOptions): Promise<ExportAuthResult> {
  try {
    serverApiOrigin();
  } catch (error) {
    if (error instanceof ApiConfigurationError) {
      return { ok: false, reponse: NextResponse.json(configErrorBody(error), { status: 500 }) };
    }
    throw error;
  }

  const session = await getSession();
  if (session === null) {
    return {
      ok: false,
      reponse: NextResponse.json({ error: 'Session expirée.' }, { status: 401 }),
    };
  }

  const allowed = options.allowedRoles;
  if (allowed !== undefined && !allowed.includes(session.role)) {
    return {
      ok: false,
      reponse: NextResponse.json(
        { error: 'Cet export n’est pas accessible avec votre rôle.' },
        { status: 403 },
      ),
    };
  }

  const accessToken = await getAccessToken();
  if (accessToken === null || accessToken === '') {
    return {
      ok: false,
      reponse: NextResponse.json({ error: 'Session expirée.' }, { status: 401 }),
    };
  }

  return { ok: true, accessToken };
}

export async function relayXlsx(options: XlsxRelayOptions): Promise<Response> {
  const auth = await resolveExportAuth(options);
  if (!auth.ok) return auth.reponse;
  const { accessToken } = auth;

  let upstream: Response;
  try {
    const result = await fetchUpstreamAvecRenouvellement(options, accessToken);
    if (!result.ok) return result.reponse;
    upstream = result.response;
  } catch {
    return NextResponse.json({ error: 'Le serveur CPI est injoignable.' }, { status: 502 });
  }

  if (!upstream.ok || upstream.body === null) {
    return NextResponse.json(
      { error: `L'export a échoué (code ${String(upstream.status)}).` },
      { status: 502 },
    );
  }

  const demo = isDemoExport(upstream.headers);

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
