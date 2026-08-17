import 'server-only';

import { createApiClient, type ApiClient } from '@crm/api-client';
import { cookies } from 'next/headers';
import { cache } from 'react';

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
  serverApiOrigin,
} from '@/lib/api/config';
import { rotateRefreshTokenDetailed, type RotatedTokens } from '@/lib/api/tokens';

export class SessionExpiredError extends Error {
  constructor() {
    super('Session expirée. Reconnectez-vous.');
    this.name = 'SessionExpiredError';
  }
}

export class SessionUnavailableError extends Error {
  constructor() {
    super('Le serveur CPI est momentanément injoignable.');
    this.name = 'SessionUnavailableError';
  }
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenTtl: number;
  refreshTokenTtl: number;
}

export function toAuthTokens(rotated: RotatedTokens): AuthTokens {
  return {
    accessToken: rotated.accessToken,
    refreshToken: rotated.refreshToken,
    accessTokenTtl: rotated.expiresIn,
    refreshTokenTtl: REFRESH_TTL_SECONDS,
  };
}

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
} as const;

export async function getAccessToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value ?? null;
}

export async function setSessionCookies(tokens: AuthTokens): Promise<boolean> {
  try {
    const store = await cookies();
    store.set(ACCESS_COOKIE, tokens.accessToken, {
      ...cookieOptions,
      maxAge: tokens.accessTokenTtl,
    });
    store.set(REFRESH_COOKIE, tokens.refreshToken, {
      ...cookieOptions,
      maxAge: tokens.refreshTokenTtl,
    });
    return true;
  } catch {
    return false;
  }
}

export async function clearSessionCookies(): Promise<boolean> {
  try {
    const store = await cookies();
    store.set(ACCESS_COOKIE, '', { ...cookieOptions, maxAge: 0 });
    store.set(REFRESH_COOKIE, '', { ...cookieOptions, maxAge: 0 });
    return true;
  } catch {
    return false;
  }
}

const requestTokenOverride = cache((): { value: string | null } => ({ value: null }));

const refreshOnce = cache(async (): Promise<AuthTokens | null> => {
  const refreshToken = await getRefreshToken();
  if (refreshToken === null || refreshToken === '') return null;

  const rotation = await rotateRefreshTokenDetailed(serverApiOrigin(), refreshToken);
  if (!rotation.ok && rotation.reason === 'unavailable') {
    throw new SessionUnavailableError();
  }
  if (!rotation.ok) {
    await clearSessionCookies();
    return null;
  }

  const tokens = toAuthTokens(rotation.tokens);
  const persisted = await setSessionCookies(tokens);
  if (!persisted) requestTokenOverride().value = tokens.accessToken;
  return tokens;
});

const fetchWithRotation: typeof globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  const replay = request.clone();

  const response = await globalThis.fetch(request);
  if (response.status !== 401) return response;

  const tokens = await refreshOnce();
  if (tokens === null) throw new SessionExpiredError();

  replay.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
  return globalThis.fetch(replay);
};

export const getServerApiClient = cache((): ApiClient =>
  createApiClient(serverApiOrigin(), {
    getAccessToken: async () => requestTokenOverride().value ?? (await getAccessToken()),
    fetch: fetchWithRotation,
  }),
);

export function getAnonymousApiClient(): ApiClient {
  return createApiClient(serverApiOrigin());
}
