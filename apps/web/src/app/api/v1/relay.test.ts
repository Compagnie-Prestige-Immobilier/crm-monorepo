import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/api/config';
import { mockCookies, type FakeCookieStore } from '@/test/cookie-store';

/**
 * Relais `/api/v1/*` — rotation du refresh token sur 401.
 *
 * C'est la mécanique la moins visible du panel et la plus coûteuse quand elle
 * manque : l'access token vaut 15 minutes, le refresh token 30 jours. Sans
 * rotation ET rejeu, l'administrateur est renvoyé vers l'écran de connexion
 * toutes les quinze minutes, au milieu d'un écran, en perdant sa saisie.
 *
 * Trois invariants, et un seul est évident :
 *  1. une réponse 401 déclenche EXACTEMENT UNE tentative de rafraîchissement ;
 *  2. la requête d'origine est REJOUÉE avec le nouveau jeton — rafraîchir sans
 *     rejouer ne répare rien du point de vue de l'utilisateur ;
 *  3. si le rafraîchissement échoue, les DEUX cookies sont effacés et la
 *     réponse porte un code que le client sait reconnaître pour rediriger.
 */

const OLD_ACCESS = 'old.access.jwt';
const NEW_ACCESS = 'new.access.jwt';
const OLD_REFRESH = 'old.refresh.jwt';
const NEW_REFRESH = 'new.refresh.jwt';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function relayRequest(path = 'prospects', search = '?page=1'): Request {
  return new Request(`http://localhost:3000/api/v1/${path}${search}`, { method: 'GET' });
}

const params = (path: string[]) => ({ params: Promise.resolve({ path }) });

/** Autorisation portée par un appel sortant, quelle que soit la forme de l'entrée. */
function authOf(call: unknown[] | undefined): string | null {
  const [input, init] = (call ?? []) as [string | Request, RequestInit | undefined];
  if (input instanceof Request) return input.headers.get('Authorization');
  const headers = new Headers(init?.headers);
  return headers.get('Authorization');
}

function urlOf(call: unknown[] | undefined): string {
  const [input] = (call ?? []) as [string | Request];
  return input instanceof Request ? input.url : input;
}

let store: FakeCookieStore;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  process.env.API_URL = 'http://api.test';
  store = mockCookies();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  store.seed(ACCESS_COOKIE, OLD_ACCESS);
  store.seed(REFRESH_COOKIE, OLD_REFRESH);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock('next/headers');
});

describe('relais en régime normal', () => {
  it('rattache le jeton du cookie et ne rafraîchit pas', async () => {
    fetchMock.mockResolvedValue(json({ items: [], meta: { total: 0 } }));
    const { GET } = await import('@/app/api/v1/[...path]/route');

    const response = await GET(relayRequest(), params(['prospects']));

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(authOf(fetchMock.mock.calls[0])).toBe(`Bearer ${OLD_ACCESS}`);
    // Le chemin et la query string sont transmis intacts.
    expect(urlOf(fetchMock.mock.calls[0])).toBe('http://api.test/api/v1/prospects?page=1');
  });

  it('répond 401 sans appeler l’API quand il n’y a pas de session', async () => {
    vi.resetModules();
    store = mockCookies(); // magasin vierge : aucun cookie de session
    const { GET } = await import('@/app/api/v1/[...path]/route');

    const response = await GET(relayRequest(), params(['prospects']));

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ne relaie JAMAIS le cookie de session vers l’API', async () => {
    // Relayer `cookie` enverrait la session Next à NestJS, qui n'en a que
    // faire, et l'inscrirait dans ses journaux d'accès.
    fetchMock.mockResolvedValue(json({ ok: true }));
    const { GET } = await import('@/app/api/v1/[...path]/route');

    const request = new Request('http://localhost:3000/api/v1/prospects', {
      headers: { cookie: `${ACCESS_COOKIE}=${OLD_ACCESS}`, accept: 'application/json' },
    });
    await GET(request, params(['prospects']));

    const [input, init] = fetchMock.mock.calls[0] as [string | Request, RequestInit];
    const headers = input instanceof Request ? input.headers : new Headers(init.headers);
    expect(headers.get('cookie')).toBeNull();
    expect(headers.get('accept')).toBe('application/json');
  });

  it('propage un 4xx métier tel quel, sans tenter de rafraîchir', async () => {
    // Un 409 « représentant encore rattaché » doit atteindre l'écran pour qu'il
    // propose la réaffectation. Le convertir en « session expirée » serait
    // absurde.
    fetchMock.mockResolvedValue(json({ statusCode: 409, message: 'Prospects rattachés.' }, 409));
    const { DELETE } = await import('@/app/api/v1/[...path]/route');

    const response = await DELETE(
      new Request('http://localhost:3000/api/v1/representants/r1', { method: 'DELETE' }),
      params(['representants', 'r1']),
    );

    expect(response.status).toBe(409);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('rotation sur 401', () => {
  it('rafraîchit UNE fois, rejoue la requête et réécrit les deux cookies', async () => {
    fetchMock
      // 1. la requête d'origine — l'access token a expiré
      .mockResolvedValueOnce(json({ statusCode: 401, message: 'Unauthorized' }, 401))
      // 2. POST /auth/refresh
      .mockResolvedValueOnce(
        json({ accessToken: NEW_ACCESS, refreshToken: NEW_REFRESH, expiresIn: 900 }),
      )
      // 3. le rejeu
      .mockResolvedValueOnce(json({ items: [{ id: 'p1' }], meta: { total: 1 } }));

    const { GET } = await import('@/app/api/v1/[...path]/route');
    const response = await GET(relayRequest(), params(['prospects']));

    // L'utilisateur reçoit sa donnée, pas une redirection.
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ items: [{ id: 'p1' }], meta: { total: 1 } });

    // Exactement trois appels : origine, refresh, rejeu. Pas deux, pas quatre.
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const refreshCalls = fetchMock.mock.calls.filter((call) =>
      urlOf(call).includes('/auth/refresh'),
    );
    expect(refreshCalls).toHaveLength(1);

    // Le rejeu porte le NOUVEAU jeton — c'est tout l'intérêt de l'opération.
    expect(authOf(fetchMock.mock.calls[0])).toBe(`Bearer ${OLD_ACCESS}`);
    expect(authOf(fetchMock.mock.calls[2])).toBe(`Bearer ${NEW_ACCESS}`);
    // ...et vise la même ressource.
    expect(urlOf(fetchMock.mock.calls[2])).toBe(urlOf(fetchMock.mock.calls[0]));

    // Les deux cookies sont mis à jour. Oublier le refresh token ferait mourir
    // la session au prochain 401 : le backend a déjà invalidé l'ancien.
    expect(store.raw(ACCESS_COOKIE)?.value).toBe(NEW_ACCESS);
    expect(store.raw(REFRESH_COOKIE)?.value).toBe(NEW_REFRESH);
    expect(store.raw(ACCESS_COOKIE)?.httpOnly).toBe(true);
    expect(store.raw(REFRESH_COOKIE)?.httpOnly).toBe(true);
  });

  it('ne rafraîchit PAS une deuxième fois si le rejeu répond encore 401', async () => {
    // La détection de rejeu du backend tue la famille entière au premier jeton
    // réutilisé. Boucler sur le rafraîchissement déconnecterait l'utilisateur
    // de tous ses appareils.
    fetchMock
      .mockResolvedValueOnce(json({ statusCode: 401 }, 401))
      .mockResolvedValueOnce(
        json({ accessToken: NEW_ACCESS, refreshToken: NEW_REFRESH, expiresIn: 900 }),
      )
      .mockResolvedValueOnce(json({ statusCode: 401 }, 401));

    const { GET } = await import('@/app/api/v1/[...path]/route');
    const response = await GET(relayRequest(), params(['prospects']));

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(
      fetchMock.mock.calls.filter((call) => urlOf(call).includes('/auth/refresh')),
    ).toHaveLength(1);
    // Le second 401 est rendu au client, qui redirigera.
    expect(response.status).toBe(401);
  });

  it('rejoue aussi le CORPS d’un POST, pas seulement l’URL', async () => {
    // Un corps déjà consommé ne se rejoue pas : une fusion de prospects perdue
    // à la quinzième minute est exactement le bug qu'on ne reproduit jamais.
    fetchMock
      .mockResolvedValueOnce(json({ statusCode: 401 }, 401))
      .mockResolvedValueOnce(
        json({ accessToken: NEW_ACCESS, refreshToken: NEW_REFRESH, expiresIn: 900 }),
      )
      .mockResolvedValueOnce(json({ id: 'target' }));

    const { POST } = await import('@/app/api/v1/[...path]/route');
    const payload = { targetId: 'a', sourceId: 'b', preferSource: false };

    const response = await POST(
      new Request('http://localhost:3000/api/v1/prospects/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }),
      params(['prospects', 'merge']),
    );

    expect(response.status).toBe(200);

    const replay = fetchMock.mock.calls[2] as [string | Request, RequestInit];
    const body =
      replay[0] instanceof Request
        ? await replay[0].text()
        : new TextDecoder().decode(replay[1].body as ArrayBuffer);
    expect(JSON.parse(body)).toEqual(payload);
  });
});

describe('échec du rafraîchissement', () => {
  it('efface les DEUX cookies et renvoie SESSION_EXPIRED', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ statusCode: 401 }, 401))
      // Famille de jetons morte : révoquée, expirée ou rejouée.
      .mockResolvedValueOnce(json({ statusCode: 401, message: 'Invalid refresh token' }, 401));

    const { GET } = await import('@/app/api/v1/[...path]/route');
    const response = await GET(relayRequest(), params(['prospects']));
    const body = (await response.json()) as { error: string; code: string };

    expect(response.status).toBe(401);
    // Le code machine permet au client de rediriger sans analyser une phrase.
    expect(body.code).toBe('SESSION_EXPIRED');
    // Le message reste actionnable pour l'humain.
    expect(body.error).toMatch(/reconnectez-vous/i);

    expect(store.isCleared(ACCESS_COOKIE)).toBe(true);
    expect(store.isCleared(REFRESH_COOKIE)).toBe(true);

    // Aucun rejeu : inutile, et le backend a tué la famille.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('efface les cookies quand le cookie de rafraîchissement est absent', async () => {
    vi.resetModules();
    store = mockCookies();
    store.seed(ACCESS_COOKIE, OLD_ACCESS); // pas de refresh token
    fetchMock.mockResolvedValueOnce(json({ statusCode: 401 }, 401));

    const { GET } = await import('@/app/api/v1/[...path]/route');
    const response = await GET(relayRequest(), params(['prospects']));

    expect(response.status).toBe(401);
    expect(store.isCleared(ACCESS_COOKIE)).toBe(true);
    // Pas d'appel à /auth/refresh sans jeton à échanger.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('ne DÉTRUIT PAS la session sur une panne réseau du backend', async () => {
    // Différence essentielle : « le serveur ne répond pas » n'est pas « votre
    // session est morte ». Déconnecter sur un hoquet réseau ferait ressaisir un
    // mot de passe pour rien.
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));

    const { GET } = await import('@/app/api/v1/[...path]/route');
    const response = await GET(relayRequest(), params(['prospects']));
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(502);
    expect(body.error).toMatch(/injoignable/i);
    // Les cookies sont INTACTS : la session redeviendra utilisable au retour
    // du réseau.
    expect(store.raw(ACCESS_COOKIE)?.value).toBe(OLD_ACCESS);
    expect(store.raw(REFRESH_COOKIE)?.value).toBe(OLD_REFRESH);
  });
});
