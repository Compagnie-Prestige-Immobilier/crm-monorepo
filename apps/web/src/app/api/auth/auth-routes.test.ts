import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/api/config';
import { mockCookies, type FakeCookieStore } from '@/test/cookie-store';

/**
 * Route Handlers d'authentification.
 *
 * Ce qui est vérifié ici n'est pas « le login marche » : c'est la frontière de
 * sécurité : aucun jeton ne doit franchir la limite serveur → navigateur
 * autrement que dans un cookie `httpOnly`. Un JWT dans le corps de la réponse
 * atterrit dans le JavaScript de la page, donc à portée de la première XSS, et
 * l'attaquant repart avec la base de prospects entière.
 */

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

    // 1. Les cookies portent bien les jetons, et sont hors de portée de JS.
    const access = store.raw(ACCESS_COOKIE);
    const refresh = store.raw(REFRESH_COOKIE);
    expect(access?.value).toBe(ACCESS_JWT);
    expect(refresh?.value).toBe(REFRESH_JWT);
    expect(access?.httpOnly).toBe(true);
    expect(refresh?.httpOnly).toBe(true);
    expect(access?.sameSite).toBe('lax');
    expect(refresh?.sameSite).toBe('lax');

    // 2. Le corps ne contient que le profil public. Assertion faite sur la
    //    sérialisation entière : une clé imbriquée ne peut pas passer entre
    //    les mailles d'un `expect(body.accessToken).toBeUndefined()`.
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
    // Dire « identifiants incorrects » à quelqu'un qui vient d'être limité
    // l'envoie réessayer en boucle et aggrave la limitation.
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
  it('refuse un COMMERCIAL avec EXACTEMENT le message d’un mot de passe faux', async () => {
    // Anti-énumération : si le refus de rôle avait son propre message, un
    // attaquant distinguerait « ce compte existe mais n'est pas admin » de
    // « ce compte n'existe pas ». La comparaison porte sur le corps complet ET
    // sur le code HTTP.
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
        user: COMMERCIAL,
      }),
    );
    const { POST: POST2 } = await import('@/app/api/auth/login/route');
    const refusedRole = await POST2(loginRequest('awa@cpi.sn', 'bonMotDePasse'));
    const refusedRoleBody = await refusedRole.text();

    expect(refusedRole.status).toBe(wrongPassword.status);
    expect(refusedRole.status).toBe(401);
    expect(refusedRoleBody).toBe(wrongPasswordBody);
  });

  it('ne pose aucun cookie pour un COMMERCIAL dont le mot de passe est pourtant bon', async () => {
    // L'API a répondu 200 avec des jetons valides : sans le contrôle de rôle,
    // le commercial entrerait dans le panel avec la liste complète des
    // prospects.
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

    expect(response.status).toBe(401);
    expect(store.raw(ACCESS_COOKIE)).toBeUndefined();
    expect(store.raw(REFRESH_COOKIE)).toBeUndefined();
    // Et surtout : les jetons du commercial ne fuitent pas dans la réponse.
    expect(await response.text()).not.toContain(ACCESS_JWT);
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

    // La révocation serveur tue toute la famille : les rotations en vol
    // meurent avec.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0] as [string | URL | Request];
    expect(String(url instanceof Request ? url.url : url)).toContain('/auth/logout');
  });

  it('efface les cookies MÊME si la révocation serveur échoue', async () => {
    // Un utilisateur qui clique « Déconnexion » doit être déconnecté de ce
    // navigateur, quoi qu'il arrive sur le réseau.
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
