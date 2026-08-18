import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/api/config';
import { mockCookies, type FakeCookieStore } from '@/test/cookie-store';

const ACCESS_JWT = 'REDACTED';
const REFRESH_JWT = 'header.eyJzdWIiOiJ1MSIsInR5cCI6InJlZnJlc2gifQ.sig';

const ADMIN = {
  id: 'u1',
  email: 'admin@cpi.sn',
  username: 'admin',
  fullName: 'Administrateur CPI',
  role: 'ADMIN',
  isActive: true,
};

const COMMERCIAL = {
  ...ADMIN,
  id: 'u2',
  email: 'awa@cpi.sn',
  fullName: 'Awa Sy',
  role: 'COMMERCIAL',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function loginRequest(identifier = 'admin@cpi.sn', password = 'ChangeMoiEnProd2026'): Request {
  return new Request('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
}

let store: FakeCookieStore;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  process.env.API_URL = 'http://api.test';
  store = mockCookies();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock('next/headers');
});

describe('POST /api/auth/login', () => {
  it('pose deux cookies httpOnly et ne renvoie AUCUN jeton dans le corps', async () => {
    fetchMock.mockResolvedValue(
      json({ accessToken: ACCESS_JWT, refreshToken: REFRESH_JWT, expiresIn: 900, user: ADMIN }),
    );
    const { POST } = await import('@/app/api/auth/login/route');

    const response = await POST(loginRequest());
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);

    const access = store.raw(ACCESS_COOKIE);
    const refresh = store.raw(REFRESH_COOKIE);
    expect(access?.value).toBe(ACCESS_JWT);
    expect(refresh?.value).toBe(REFRESH_JWT);
    expect(access?.httpOnly).toBe(true);
    expect(refresh?.httpOnly).toBe(true);
    expect(access?.sameSite).toBe('lax');
    expect(refresh?.sameSite).toBe('lax');

    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain(ACCESS_JWT);
    expect(serialized).not.toContain(REFRESH_JWT);
    expect(serialized).not.toMatch(/accessToken|refreshToken/);
    expect(body).toEqual({ user: ADMIN });
  });

  it('applique le maxAge renvoyé par l’API à l’access token', async () => {
    fetchMock.mockResolvedValue(
      json({ accessToken: ACCESS_JWT, refreshToken: REFRESH_JWT, expiresIn: 900, user: ADMIN }),
    );
    const { POST } = await import('@/app/api/auth/login/route');

    await POST(loginRequest());

    expect(store.raw(ACCESS_COOKIE)?.maxAge).toBe(900);
    expect(store.raw(REFRESH_COOKIE)?.maxAge).toBe(30 * 24 * 60 * 60);
  });

  it('refuse un mot de passe faux sans poser de cookie', async () => {
    fetchMock.mockResolvedValue(json({ statusCode: 401, message: 'Unauthorized' }, 401));
    const { POST } = await import('@/app/api/auth/login/route');

    const response = await POST(loginRequest('admin@cpi.sn', 'mauvaisMotDePasse'));

    expect(response.status).toBe(401);
    expect(store.raw(ACCESS_COOKIE)).toBeUndefined();
    expect(store.raw(REFRESH_COOKIE)).toBeUndefined();
  });

  it('signale explicitement une limitation de débit (429), pas un mot de passe faux', async () => {
    fetchMock.mockResolvedValue(json({ statusCode: 429, message: 'Too Many Requests' }, 429));
    const { POST } = await import('@/app/api/auth/login/route');

    const response = await POST(loginRequest());
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(429);
    expect(body.error).toMatch(/tentatives/i);
  });

  it('rejette un corps illisible en 400 sans appeler l’API', async () => {
    const { POST } = await import('@/app/api/auth/login/route');

    const response = await POST(
      new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'pas du json',
      }),
    );

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('cloisonnement des rôles à la connexion', () => {
  it('refuse un rôle hors panel avec EXACTEMENT le message d’un mot de passe faux', async () => {
    const { POST } = await import('@/app/api/auth/login/route');

    fetchMock.mockResolvedValue(json({ statusCode: 401, message: 'Unauthorized' }, 401));
    const wrongPassword = await POST(loginRequest('admin@cpi.sn', 'mauvaisMotDePasse'));
    const wrongPasswordBody = await wrongPassword.text();

    vi.resetModules();
    store = mockCookies();
    fetchMock.mockResolvedValue(
      json({
        accessToken: ACCESS_JWT,
        refreshToken: REFRESH_JWT,
        expiresIn: 900,
        user: { ...ADMIN, id: 'u3', role: 'ROLE_INCONNU' },
      }),
    );
    const { POST: POST2 } = await import('@/app/api/auth/login/route');
    const refusedRole = await POST2(loginRequest('sombre@cpi.sn', 'bonMotDePasse'));
    const refusedRoleBody = await refusedRole.text();

    expect(refusedRole.status).toBe(wrongPassword.status);
    expect(refusedRole.status).toBe(401);
    expect(refusedRoleBody).toBe(wrongPasswordBody);
    expect(store.raw(ACCESS_COOKIE)).toBeUndefined();
    expect(store.raw(REFRESH_COOKIE)).toBeUndefined();
  });

  it('pose les cookies d’un COMMERCIAL, que le panel admet désormais', async () => {
    fetchMock.mockResolvedValue(
      json({
        accessToken: ACCESS_JWT,
        refreshToken: REFRESH_JWT,
        expiresIn: 900,
        user: COMMERCIAL,
      }),
    );
    const { POST } = await import('@/app/api/auth/login/route');

    const response = await POST(loginRequest('awa@cpi.sn', 'bonMotDePasse'));
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toEqual({ user: COMMERCIAL });
    expect(store.raw(ACCESS_COOKIE)?.value).toBe(ACCESS_JWT);
    expect(store.raw(REFRESH_COOKIE)?.value).toBe(REFRESH_JWT);
  });
});

describe('POST /api/auth/logout', () => {
  it('efface les deux cookies et révoque la famille côté API', async () => {
    store.seed(ACCESS_COOKIE, ACCESS_JWT);
    store.seed(REFRESH_COOKIE, REFRESH_JWT);
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    const { POST } = await import('@/app/api/auth/logout/route');

    const response = await POST();

    expect(response.status).toBe(200);
    expect(store.isCleared(ACCESS_COOKIE)).toBe(true);
    expect(store.isCleared(REFRESH_COOKIE)).toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string | URL | Request];
    expect(String(url instanceof Request ? url.url : url)).toContain('/auth/logout');
  });

  it('efface les cookies MÊME si la révocation serveur échoue', async () => {
    store.seed(ACCESS_COOKIE, ACCESS_JWT);
    store.seed(REFRESH_COOKIE, REFRESH_JWT);
    fetchMock.mockRejectedValue(new Error('réseau coupé'));
    const { POST } = await import('@/app/api/auth/logout/route');

    const response = await POST();

    expect(response.status).toBe(200);
    expect(store.isCleared(ACCESS_COOKIE)).toBe(true);
    expect(store.isCleared(REFRESH_COOKIE)).toBe(true);
  });

  it('n’appelle pas l’API quand il n’y a pas de session, mais efface quand même', async () => {
    const { POST } = await import('@/app/api/auth/logout/route');

    await POST();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(store.isCleared(ACCESS_COOKIE)).toBe(true);
    expect(store.isCleared(REFRESH_COOKIE)).toBe(true);
  });
});
