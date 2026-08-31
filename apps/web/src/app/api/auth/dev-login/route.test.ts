import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { LoginResult } from '@/lib/data/auth';

const authenticate = vi.hoisted(() =>
  vi.fn<(identifier: string, password: string, client: unknown) => Promise<LoginResult | null>>(),
);
const getAnonymousApiClient = vi.hoisted(() => vi.fn<() => unknown>());
const setSessionCookies = vi.hoisted(() =>
  vi.fn<(tokens: LoginResult['tokens']) => Promise<boolean>>(),
);

vi.mock('@/lib/data/auth', () => ({
  PANEL_ROLES: ['ADMIN', 'COMMERCIAL', 'BANQUE_FINANCE', 'SUPERVISEUR', 'DIRECTION', 'ACCUEIL'],
  authenticate,
}));

vi.mock('@/lib/api/server', () => ({ getAnonymousApiClient, setSessionCookies }));

const result = {
  tokens: {
    accessToken: 'access',
    refreshToken: 'refresh',
    accessTokenTtl: 900,
    refreshTokenTtl: 30 * 24 * 60 * 60,
  },
  user: {
    id: 'fixture-1',
    email: 'fixture.awa@cpi.sn',
    username: 'fixture.awa',
    fullName: 'Awa Fixture',
    role: 'COMMERCIAL',
    isActive: true,
    workspace: 'public',
  },
} as LoginResult;

function request(role: unknown): Request {
  return new Request('http://localhost:3000/api/auth/dev-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('NODE_ENV', 'development');
  authenticate.mockReset();
  getAnonymousApiClient.mockReset();
  setSessionCookies.mockReset();
  getAnonymousApiClient.mockReturnValue({});
  setSessionCookies.mockResolvedValue(true);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('POST /api/auth/dev-login', () => {
  it('refuse un rôle inconnu sans appeler l’authentification', async () => {
    const { POST } = await import('@/app/api/auth/dev-login/route');

    const response = await POST(request('ROLE_INCONNU'));

    expect(response.status).toBe(400);
    expect(authenticate).not.toHaveBeenCalled();
  });

  it('connecte le compte fixture avec le vrai login et pose la session', async () => {
    authenticate.mockResolvedValue(result);
    const { POST } = await import('@/app/api/auth/dev-login/route');

    const response = await POST(request('COMMERCIAL'));

    expect(response.status).toBe(200);
    expect(authenticate).toHaveBeenCalledWith(
      'fixture.awa@cpi.sn',
      'ChangeMoi123456',
      expect.anything(),
    );
    expect(setSessionCookies).toHaveBeenCalledWith(result.tokens);
    await expect(response.json()).resolves.toEqual({ user: result.user });
  });

  it('est absente hors développement', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { POST } = await import('@/app/api/auth/dev-login/route');

    const response = await POST(request('ADMIN'));

    expect(response.status).toBe(404);
    expect(authenticate).not.toHaveBeenCalled();
  });
});
