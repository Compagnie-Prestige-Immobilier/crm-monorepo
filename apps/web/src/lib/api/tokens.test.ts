import { describe, expect, it, vi } from 'vitest';

import {
  isAccessTokenStale,
  readJwtExpiry,
  rotateRefreshToken,
  rotateRefreshTokenDetailed,
} from '@/lib/api/tokens';

/** Fabrique un JWT non signé dont seul `exp` compte ici. */
function jwtExpiringAt(epochSeconds: number): string {
  const payload = Buffer.from(JSON.stringify({ sub: 'u1', exp: epochSeconds })).toString(
    'base64url',
  );
  return `header.${payload}.signature`;
}

describe('readJwtExpiry', () => {
  it('lit `exp` sans vérifier la signature', () => {
    expect(readJwtExpiry(jwtExpiringAt(1_800_000_000))).toBe(1_800_000_000);
  });

  it('renvoie null sur une chaîne qui n’est pas un JWT', () => {
    expect(readJwtExpiry('pas-un-jwt')).toBeNull();
    expect(readJwtExpiry('')).toBeNull();
    expect(readJwtExpiry('a..c')).toBeNull();
    expect(readJwtExpiry('header.!!!base64-invalide!!!.sig')).toBeNull();
  });

  it('renvoie null quand `exp` est absent ou n’est pas un nombre', () => {
    const payload = Buffer.from(JSON.stringify({ sub: 'u1', exp: 'bientôt' })).toString(
      'base64url',
    );
    expect(readJwtExpiry(`header.${payload}.sig`)).toBeNull();
  });
});

describe('isAccessTokenStale', () => {
  const now = 1_700_000_000_000;

  it('considère périmé un jeton absent ou vide', () => {
    expect(isAccessTokenStale(null, now)).toBe(true);
    expect(isAccessTokenStale(undefined, now)).toBe(true);
    expect(isAccessTokenStale('', now)).toBe(true);
  });

  it('considère périmé un jeton dont l’expiration est illisible', () => {
    expect(isAccessTokenStale('jeton-tronqué', now)).toBe(true);
  });

  it('laisse passer un jeton encore largement valable', () => {
    expect(isAccessTokenStale(jwtExpiringAt(now / 1000 + 600), now)).toBe(false);
  });

  it('considère périmé un jeton déjà expiré', () => {
    expect(isAccessTokenStale(jwtExpiringAt(now / 1000 - 1), now)).toBe(true);
  });

  it('rafraîchit dans la marge de 60 s AVANT l’expiration', () => {
    expect(isAccessTokenStale(jwtExpiringAt(now / 1000 + 30), now)).toBe(true);
    expect(isAccessTokenStale(jwtExpiringAt(now / 1000 + 61), now)).toBe(false);
  });
});

describe('rotateRefreshToken', () => {
  const ok = { accessToken: 'new.access', refreshToken: 'new.refresh', expiresIn: 900 };

  it('échange le jeton et rapporte la durée de vie annoncée', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(ok), { status: 200 })),
    );
    const rotated = await rotateRefreshToken('http://api.test', 'old.refresh', fetchImpl);
    expect(rotated).toEqual(ok);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://api.test/api/v1/auth/refresh');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ refreshToken: 'old.refresh' });
    expect(init.cache).toBe('no-store');
  });

  it('retombe sur 900 s quand l’API n’annonce pas `expiresIn`', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify({ accessToken: 'a', refreshToken: 'r' }), { status: 200 }),
      ),
    );
    expect(await rotateRefreshToken('http://api.test', 'old', fetchImpl)).toEqual({
      accessToken: 'a',
      refreshToken: 'r',
      expiresIn: 900,
    });
  });

  it('renvoie null : famille morte : sur un refus de l’API', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response('{}', { status: 401 })));
    expect(await rotateRefreshToken('http://api.test', 'revoked', fetchImpl)).toBeNull();
  });

  it('renvoie null sur une réponse 200 au corps inexploitable', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response('<html>portail captif</html>', { status: 200 })),
    );
    expect(await rotateRefreshToken('http://api.test', 'old', fetchImpl)).toBeNull();
  });

  it('renvoie null si le corps n’a pas les deux jetons', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify({ accessToken: 'a' }), { status: 200 })),
    );
    expect(await rotateRefreshToken('http://api.test', 'old', fetchImpl)).toBeNull();
  });

  it('renvoie null sans appeler l’API pour un jeton vide', async () => {
    const fetchImpl = vi.fn();
    expect(await rotateRefreshToken('http://api.test', '', fetchImpl)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('renvoie null sur panne réseau, sans lever', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error('ECONNREFUSED')));
    await expect(rotateRefreshToken('http://api.test', 'old', fetchImpl)).resolves.toBeNull();
  });

  it('signale une panne réseau comme temporaire, pas comme session invalide', async () => {
    const fetchImpl = vi.fn(() => Promise.reject(new Error('ECONNREFUSED')));
    await expect(rotateRefreshTokenDetailed('http://api.test', 'old', fetchImpl)).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });

  /**
   * ═══════════════════════════════════════════════════════════════════════════
   * Un serveur qui répond MAL ne doit pas être traité plus durement qu'un
   * serveur MUET.
   * ═══════════════════════════════════════════════════════════════════════════
   *
   * `unavailable` fait garder les cookies (`proxy.ts`), `invalid` les efface et
   * renvoie à l'écran de connexion. Tout statut non 2xx valait `invalid`, donc
   * une réponse qui ne dit RIEN du jeton détruisait quand même la session.
   *
   * Le 429 n'est pas théorique : `ThrottlerGuard` est une garde GLOBALE de
   * l'API, `/auth/refresh` est donc plafonné, et le contrat ne déclare pour
   * cette route que 200 et 401. Le statut que le client ne prévoyait pas est
   * exactement celui qui déconnectait.
   */
  it('ne tue PAS la session sur un 429 : le plafond ne juge pas le jeton', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response('{}', { status: 429 })));
    await expect(rotateRefreshTokenDetailed('http://api.test', 'old', fetchImpl)).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });

  it('ne tue PAS la session sur une passerelle en panne', async () => {
    // 502, 503, 504 : l'API redémarre ou un intermédiaire répond à sa place.
    // Le refresh token sera toujours valable dans dix secondes.
    for (const status of [500, 502, 503, 504]) {
      const fetchImpl = vi.fn(() => Promise.resolve(new Response('', { status })));
      await expect(
        rotateRefreshTokenDetailed('http://api.test', `old-${String(status)}`, fetchImpl),
      ).resolves.toEqual({ ok: false, reason: 'unavailable' });
    }
  });

  it('tue la session sur un 401 : là, l’API s’est prononcée sur le jeton', async () => {
    // Le pendant indispensable des deux tests ci-dessus : élargir `unavailable`
    // à tout ne ferait plus jamais effacer un jeton révoqué, et l'utilisateur
    // resterait coincé sur une session morte.
    const fetchImpl = vi.fn(() => Promise.resolve(new Response('{}', { status: 401 })));
    await expect(
      rotateRefreshTokenDetailed('http://api.test', 'revoked', fetchImpl),
    ).resolves.toEqual({ ok: false, reason: 'invalid' });
  });

  it('single-flight le même refresh token pendant les requêtes concurrentes', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return new Response(JSON.stringify(ok), { status: 200 });
    });
    const result = await Promise.all(
      Array.from({ length: 6 }, () => rotateRefreshToken('http://api.test', 'same', fetchImpl)),
    );
    expect(calls).toBe(1);
    expect(result).toEqual(Array.from({ length: 6 }, () => ok));
  });
});
