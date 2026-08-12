import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/api/config';
import { mockCookies, type FakeCookieStore } from '@/test/cookie-store';

/**
 * `GET /api/export/prospects`.
 *
 * Deux exigences que rien d'autre ne couvre :
 *
 *  - Le fichier doit arriver comme un vrai `.xlsx` — bon `Content-Type`, bon
 *    `Content-Disposition`. Un octet-stream nommé sans extension s'ouvre dans
 *    le navigateur au lieu d'Excel.
 *  - En cas d'échec amont, surtout PAS de fichier de repli. Un `.xlsx`
 *    contenant un message d'erreur serait transmis à la direction sans que
 *    personne ne l'ouvre avant la réunion.
 */

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const ACCESS = 'access.jwt';
const REFRESH = 'refresh.jwt';

const SESSION_USER = {
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

/** Réponse imitant le flux binaire du backend. */
function xlsx(): Response {
  return new Response(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), {
    status: 200,
    headers: { 'Content-Type': XLSX_MIME },
  });
}

function urlOf(call: unknown[] | undefined): string {
  const [input] = (call ?? []) as [string | Request];
  return input instanceof Request ? input.url : input;
}

function exportRequest(search = ''): Request {
  return new Request(`http://localhost:3000/api/export/prospects${search}`);
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

describe('export en régime normal', () => {
  it('renvoie le flux avec le type MIME et le nom de fichier attendus', async () => {
    fetchMock
      .mockResolvedValueOnce(json(SESSION_USER)) // GET /auth/me (vérification de session)
      .mockResolvedValueOnce(xlsx());
    const { GET } = await import('@/app/api/export/prospects/route');

    const response = await GET(exportRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe(XLSX_MIME);
    // `attachment` déclenche le téléchargement ; sans lui, Excel n'est jamais
    // proposé. Le nom est daté pour ne pas empiler dix `prospects.xlsx`.
    expect(response.headers.get('Content-Disposition')).toMatch(
      /^attachment; filename="cpi-prospects-\d{4}-\d{2}-\d{2}\.xlsx"$/,
    );
    expect(response.headers.get('Cache-Control')).toBe('no-store');

    // Le corps est bien le binaire amont (signature ZIP « PK\x03\x04 »).
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
  });

  it('transmet les filtres et écarte pagination et tri', async () => {
    fetchMock.mockResolvedValueOnce(json(SESSION_USER)).mockResolvedValueOnce(xlsx());
    const { GET } = await import('@/app/api/export/prospects/route');

    await GET(exportRequest('?statut=CONVERTI&banqueId=b-1&page=4&pageSize=100&sortBy=nom'));

    const upstream = new URL(urlOf(fetchMock.mock.calls[1]));
    expect(upstream.pathname).toBe('/api/v1/export/prospects.xlsx');
    expect(upstream.searchParams.get('statut')).toBe('CONVERTI');
    expect(upstream.searchParams.get('banqueId')).toBe('b-1');
    // Un export contient TOUTE la sélection, jamais la page affichée.
    expect(upstream.searchParams.has('page')).toBe(false);
    expect(upstream.searchParams.has('pageSize')).toBe(false);
    expect(upstream.searchParams.has('sortBy')).toBe(false);
  });

  it('n’envoie pas à l’API un paramètre inventé dans l’URL', async () => {
    // L'URL repasse par le parseur : une valeur bricolée à la main est écartée
    // plutôt que relayée telle quelle.
    fetchMock.mockResolvedValueOnce(json(SESSION_USER)).mockResolvedValueOnce(xlsx());
    const { GET } = await import('@/app/api/export/prospects/route');

    await GET(exportRequest('?statut=TOUT_SUPPRIMER&inconnu=1'));

    const upstream = new URL(urlOf(fetchMock.mock.calls[1]));
    expect(upstream.searchParams.has('statut')).toBe(false);
    expect(upstream.searchParams.has('inconnu')).toBe(false);
  });
});

describe('export : échecs', () => {
  it('refuse sans session, sans appeler l’export', async () => {
    vi.resetModules();
    mockCookies(); // aucun cookie
    const { GET } = await import('@/app/api/export/prospects/route');

    const response = await GET(exportRequest());

    expect(response.status).toBe(401);
    expect(response.headers.get('Content-Type')).toMatch(/application\/json/);
  });

  it('ne fabrique JAMAIS un .xlsx de repli quand l’amont échoue', async () => {
    fetchMock
      .mockResolvedValueOnce(json(SESSION_USER))
      .mockResolvedValueOnce(json({ statusCode: 500, message: 'Génération impossible.' }, 500));
    const { GET } = await import('@/app/api/export/prospects/route');

    const response = await GET(exportRequest());

    expect(response.status).toBe(502);
    // Le point critique : le client ne doit pas recevoir quelque chose qui
    // ressemble à un classeur.
    expect(response.headers.get('Content-Type')).not.toBe(XLSX_MIME);
    expect(response.headers.get('Content-Disposition')).toBeNull();
    const body = (await response.json()) as { error: string };
    // Message actionnable, avec le code amont pour le support.
    expect(body.error).toMatch(/500/);
  });

  it('rafraîchit une fois puis rejoue quand l’export répond 401', async () => {
    fetchMock
      .mockResolvedValueOnce(json(SESSION_USER))
      .mockResolvedValueOnce(json({ statusCode: 401 }, 401))
      .mockResolvedValueOnce(
        json({ accessToken: 'new.access', refreshToken: 'new.refresh', expiresIn: 900 }),
      )
      .mockResolvedValueOnce(xlsx());
    const { GET } = await import('@/app/api/export/prospects/route');

    const response = await GET(exportRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe(XLSX_MIME);
    expect(store.raw(ACCESS_COOKIE)?.value).toBe('new.access');
    expect(store.raw(REFRESH_COOKIE)?.value).toBe('new.refresh');
  });

  it('efface les cookies si la rotation échoue pendant un export', async () => {
    fetchMock
      .mockResolvedValueOnce(json(SESSION_USER))
      .mockResolvedValueOnce(json({ statusCode: 401 }, 401))
      .mockResolvedValueOnce(json({ statusCode: 401 }, 401)); // refresh refusé
    const { GET } = await import('@/app/api/export/prospects/route');

    const response = await GET(exportRequest());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(401);
    expect(body.code).toBe('SESSION_EXPIRED');
    expect(store.isCleared(ACCESS_COOKIE)).toBe(true);
    expect(store.isCleared(REFRESH_COOKIE)).toBe(true);
  });

  it('répond 502 lisible quand le backend est injoignable', async () => {
    fetchMock
      .mockResolvedValueOnce(json(SESSION_USER))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const { GET } = await import('@/app/api/export/prospects/route');

    const response = await GET(exportRequest());
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(502);
    expect(body.error).toMatch(/injoignable/i);
  });
});
