import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/api/config';
import { mockCookies, type FakeCookieStore } from '@/test/cookie-store';

const REFRESH = 'refresh.jwt';
const NEW_ACCESS_EXPIRY = 900;

/** Un jeton d'accès dont `exp` tombe dans `seconds`. */
function accessToken(seconds: number): string {
  const claims = { exp: Math.floor(Date.now() / 1000) + seconds };
  return `header.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.signature`;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function uploadRequest(): Request {
  return new Request('http://localhost:3000/api/app-updates/android', {
    method: 'POST',
    headers: { 'content-type': 'multipart/form-data; boundary=----cpi' },
    body: '------cpi\r\nContent-Disposition: form-data; name="file"\r\n\r\nAPK\r\n------cpi--',
  });
}

function initOf(call: unknown[] | undefined): RequestInit & { duplex?: string } {
  const [, init] = (call ?? []) as [string, RequestInit & { duplex?: string }];
  return init;
}

function urlOf(call: unknown[] | undefined): string {
  return ((call ?? [])[0] as string) ?? '';
}

let store: FakeCookieStore;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetModules();
  process.env.API_URL = 'http://api.test';
  store = mockCookies();
  fetchMock = vi.fn<(input: string, init: RequestInit) => Promise<Response>>();
  vi.stubGlobal('fetch', fetchMock);
  store.seed(ACCESS_COOKIE, accessToken(NEW_ACCESS_EXPIRY));
  store.seed(REFRESH_COOKIE, REFRESH);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock('next/headers');
});

describe('dépôt d’un APK', () => {
  it('relaie le corps EN FLUX, sans le charger en mémoire', async () => {
    fetchMock.mockResolvedValue(json({ versionCode: 12 }, 201));
    const { POST } = await import('@/app/api/app-updates/android/route');

    const request = uploadRequest();
    const response = await POST(request);

    expect(response.status).toBe(201);
    expect(request.bodyUsed).toBe(false);

    const init = initOf(fetchMock.mock.calls[0]);
    expect(init.body).toBeInstanceOf(ReadableStream);
    expect(init.duplex).toBe('half');
    expect(urlOf(fetchMock.mock.calls[0])).toBe('http://api.test/api/v1/app-updates/android');
  });

  it('transmet le type multipart tel quel, avec le jeton du cookie', async () => {
    fetchMock.mockResolvedValue(json({ versionCode: 12 }, 201));
    const { POST } = await import('@/app/api/app-updates/android/route');

    await POST(uploadRequest());

    const headers = new Headers(initOf(fetchMock.mock.calls[0]).headers);
    expect(headers.get('content-type')).toBe('multipart/form-data; boundary=----cpi');
    expect(headers.get('authorization')).toMatch(/^Bearer header\./u);
  });

  // Un corps en flux ne se rejoue pas : rafraîchir APRÈS un 401 perdrait le fichier.
  it('rafraîchit le jeton AVANT l’envoi quand il est périmé, et n’envoie qu’une fois', async () => {
    store.seed(ACCESS_COOKIE, accessToken(10));
    fetchMock
      .mockResolvedValueOnce(
        json({ accessToken: 'new.access.jwt', refreshToken: 'new.refresh.jwt', expiresIn: 900 }),
      )
      .mockResolvedValueOnce(json({ versionCode: 12 }, 201));

    const { POST } = await import('@/app/api/app-updates/android/route');
    const response = await POST(uploadRequest());

    expect(response.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(urlOf(fetchMock.mock.calls[0])).toContain('/auth/refresh');

    const headers = new Headers(initOf(fetchMock.mock.calls[1]).headers);
    expect(headers.get('authorization')).toBe('Bearer new.access.jwt');
    expect(store.raw(ACCESS_COOKIE)?.value).toBe('new.access.jwt');
  });

  it('ne rafraîchit pas un jeton encore valable', async () => {
    fetchMock.mockResolvedValue(json({ versionCode: 12 }, 201));
    const { POST } = await import('@/app/api/app-updates/android/route');

    await POST(uploadRequest());

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rend le refus de l’API tel quel', async () => {
    fetchMock.mockResolvedValue(
      json({ statusCode: 422, code: 'APK_SIGNER_MISMATCH', message: 'Signataire inattendu.' }, 422),
    );
    const { POST } = await import('@/app/api/app-updates/android/route');

    const response = await POST(uploadRequest());
    const body = (await response.json()) as { code: string };

    expect(response.status).toBe(422);
    expect(body.code).toBe('APK_SIGNER_MISMATCH');
  });

  it('répond 401 sans session, sans appeler l’API', async () => {
    vi.resetModules();
    store = mockCookies();
    const { POST } = await import('@/app/api/app-updates/android/route');

    const response = await POST(uploadRequest());

    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('répond 502 quand le serveur CPI est injoignable', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNREFUSED'));
    const { POST } = await import('@/app/api/app-updates/android/route');

    const response = await POST(uploadRequest());
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(502);
    expect(body.error).toMatch(/injoignable/u);
  });
});
