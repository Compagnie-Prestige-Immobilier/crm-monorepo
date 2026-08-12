import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/api/config';
import { mockCookies, type FakeCookieStore } from '@/test/cookie-store';

/**
 * Lecture de session : distinguer « jeton refusé » de « API indisponible ».
 *
 * Régression constatée en conditions réelles, journaux à l'appui :
 *
 *   GET /api/v1/referentiels  429   (limiteur de débit de l'API)
 *   GET /tableau-de-bord      307 → /connexion
 *
 * ...alors que `cpi_at` et `cpi_rt` étaient tous deux valides. La cause : un
 * `catch` qui renvoyait `null` pour n'importe quelle exception. L'utilisateur
 * était déconnecté par une pointe de charge, se reconnectait — consommant le
 * quota de connexion, 10/min — et se faisait éjecter de nouveau.
 */

const ACCESS = 'access.jwt';
const REFRESH = 'refresh.jwt';

const USER = {
  id: 'u1',
  email: 'admin@cpi.sn',
  username: 'admin',
  fullName: 'Administrateur CPI',
  role: 'ADMIN',
  isActive: true,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
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
  store.seed(ACCESS_COOKIE, ACCESS);
  store.seed(REFRESH_COOKIE, REFRESH);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock('next/headers');
});

describe('readSession', () => {
  it('rend l’utilisateur quand l’API répond', async () => {
    fetchMock.mockResolvedValue(json(USER));
    const { readSession } = await import('@/lib/session');

    expect(await readSession()).toEqual({ status: 'authenticated', user: USER });
  });

  it('rend « anonymous » sur un refus formel (401)', async () => {
    // Un 401 qui survit à la rotation : la famille de jetons est morte.
    fetchMock
      .mockResolvedValueOnce(json({ statusCode: 401 }, 401))
      .mockResolvedValueOnce(json({ statusCode: 401 }, 401)); // refresh refusé

    const { readSession } = await import('@/lib/session');

    expect((await readSession()).status).toBe('anonymous');
  });

  it('rend « anonymous » sur un 403', async () => {
    fetchMock.mockResolvedValue(json({ statusCode: 403, message: 'Interdit' }, 403));
    const { readSession } = await import('@/lib/session');

    expect((await readSession()).status).toBe('anonymous');
  });

  it('rend « unavailable » — PAS « anonymous » — sur un 429', async () => {
    // LE test de non-régression. Auparavant : `null`, donc redirection vers
    // /connexion malgré une session parfaitement valide.
    fetchMock.mockResolvedValue(json({ statusCode: 429, message: 'Too Many Requests' }, 429));
    const { readSession } = await import('@/lib/session');

    const result = await readSession();

    expect(result.status).toBe('unavailable');
    // Et les cookies restent en place : rien n'est détruit.
    expect(store.raw(ACCESS_COOKIE)?.value).toBe(ACCESS);
    expect(store.raw(REFRESH_COOKIE)?.value).toBe(REFRESH);
  });

  it('rend « unavailable » sur un 500', async () => {
    fetchMock.mockResolvedValue(json({ statusCode: 500 }, 500));
    const { readSession } = await import('@/lib/session');

    expect((await readSession()).status).toBe('unavailable');
  });

  it('rend « unavailable » quand le backend est éteint', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const { readSession } = await import('@/lib/session');

    expect((await readSession()).status).toBe('unavailable');
  });

  it('rend « anonymous » quand il n’y a aucun cookie', async () => {
    vi.resetModules();
    mockCookies();
    fetchMock.mockResolvedValue(json({ statusCode: 401 }, 401));
    const { readSession } = await import('@/lib/session');

    expect((await readSession()).status).toBe('anonymous');
  });
});

describe('getSession', () => {
  it('renvoie null pour toute lecture non authentifiée', async () => {
    fetchMock.mockResolvedValue(json({ statusCode: 429 }, 429));
    const { getSession } = await import('@/lib/session');

    // La forme binaire est conservée pour l'écran de connexion, qui n'a qu'un
    // « déjà connecté ou non » à trancher.
    expect(await getSession()).toBeNull();
  });

  it('renvoie l’utilisateur quand la session est valide', async () => {
    fetchMock.mockResolvedValue(json(USER));
    const { getSession } = await import('@/lib/session');

    expect(await getSession()).toEqual(USER);
  });
});

describe('getAdminSession', () => {
  it('refuse un COMMERCIAL même authentifié', async () => {
    fetchMock.mockResolvedValue(json({ ...USER, role: 'COMMERCIAL' }));
    const { getAdminSession } = await import('@/lib/session');

    expect(await getAdminSession()).toBeNull();
  });

  it('accepte un ADMIN', async () => {
    fetchMock.mockResolvedValue(json(USER));
    const { getAdminSession } = await import('@/lib/session');

    expect(await getAdminSession()).toEqual(USER);
  });
});
