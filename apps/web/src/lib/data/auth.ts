import type { ApiClient } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import type { Role, SessionUser } from '@/lib/types';

export const PANEL_ROLES: readonly Role[] = [
  'ADMIN',
  'BANQUE_FINANCE',
  'COMMERCIAL',
  'SUPERVISEUR',
  'DIRECTION',
  'ACCUEIL',
];

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenTtl: number;
  refreshTokenTtl: number;
}

export interface LoginResult {
  tokens: AuthTokens;
  user: SessionUser;
}

const REFRESH_TTL = 30 * 24 * 60 * 60;

const PANEL_USER_AGENT = 'cpi-go-admin-panel';

export async function authenticate(
  identifier: string,
  password: string,
  client: ApiClient,
): Promise<LoginResult | null> {
  const result = await client.POST('/api/v1/auth/login', {
    params: { header: { 'user-agent': PANEL_USER_AGENT } },
    body: { identifier, password },
  });

  if (result.response.status === 401) return null;

  const payload = unwrap(result);

  if (!PANEL_ROLES.includes(payload.user.role)) return null;

  return {
    tokens: {
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      accessTokenTtl: payload.expiresIn,
      refreshTokenTtl: REFRESH_TTL,
    },
    user: payload.user,
  };
}

export async function fetchSessionUser(client: ApiClient = getApiClient()): Promise<SessionUser> {
  return unwrap(await client.GET('/api/v1/auth/me'));
}

export async function revokeSession(refreshToken: string, client: ApiClient): Promise<void> {
  await client.POST('/api/v1/auth/logout', { body: { refreshToken } });
}

export async function changeMyPassword(
  currentPassword: string,
  newPassword: string,
  client: ApiClient = getApiClient(),
): Promise<void> {
  unwrap(await client.PUT('/api/v1/auth/me/password', { body: { currentPassword, newPassword } }));
}
