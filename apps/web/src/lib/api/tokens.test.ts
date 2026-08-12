import { describe, expect, it, vi } from 'vitest';

import { isAccessTokenStale, readJwtExpiry, rotateRefreshToken } from '@/lib/api/tokens';

/**
 * Mécanique de rotation, sans cookies ni `next/headers`.
 *
 * C'est ce que `proxy.ts` consulte AVANT chaque rendu pour rafraîchir par
 * anticipation. La règle qui compte : dans le doute, on considère le jeton
 * périmé. Un rafraîchissement inutile coûte un aller-retour ; un 401 au milieu
 * d'un rendu de composant serveur coûte la page, parce qu'un composant serveur
 * ne peut pas réécrire de cookie.
 */

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
    // Ne jamais laisser un cookie corrompu faire échouer un rendu.
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
  const now = 1_700_000_000_000; // ms

  it('considère périmé un jeton absent ou vide', () => {
    expect(isAccessTokenStale(null, now)).toBe(true);
    expect(isAccessTokenStale(undefined, now)).toBe(true);
    expect(isAccessTokenStale('', now)).toBe(true);
  });

  it('considère périmé un jeton dont l’expiration est illisible', () => {
    // Dans le doute, on rafraîchit : l'inverse produirait un 401 en plein rendu.
    expect(isAccessTokenStale('jeton-tronqué', now)).toBe(true);
  });

  it('laisse passer un jeton encore largement valable', () => {
    expect(isAccessTokenStale(jwtExpiringAt(now / 1000 + 600), now)).toBe(false);
  });

  it('considère périmé un jeton déjà expiré', () => {
    expect(isAccessTokenStale(jwtExpiringAt(now / 1000 - 1), now)).toBe(true);
  });

  it('rafraîchit dans la marge de 60 s AVANT l’expiration', () => {
    // La marge couvre la dérive d'horloge entre Next et l'API, plus un rendu
    // serveur un peu long : un jeton qui expire dans 30 s serait mort à
    // l'arrivée.
    expect(isAccessTokenStale(jwtExpiringAt(now / 1000 + 30), now)).toBe(true);
    expect(isAccessTokenStale(jwtExpiringAt(now / 1000 + 61), now)).toBe(false);
  });
});

describe('rotateRefreshToken', () => {
  const ok = {
    accessToken: 'new.access',
    refreshToken: 'new.refresh',
    expiresIn: 900,
  };

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
    // Une rotation servie depuis un cache rejouerait un jeton déjà consommé et
    // tuerait la famille.
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

  it('renvoie null — famille morte — sur un refus de l’API', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response('{}', { status: 401 })));
    expect(await rotateRefreshToken('http://api.test', 'revoked', fetchImpl)).toBeNull();
  });

  it('renvoie null sur une réponse 200 au corps inexploitable', async () => {
    // Un proxy d'entreprise qui renvoie une page HTML en 200 ne doit pas
    // produire un couple de jetons vides.
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
    // L'appelant décidera d'effacer ou non ; ce module ne doit jamais faire
    // tomber un rendu pour un `ECONNREFUSED`.
    const fetchImpl = vi.fn(() => Promise.reject(new Error('ECONNREFUSED')));
    await expect(rotateRefreshToken('http://api.test', 'old', fetchImpl)).resolves.toBeNull();
  });
});
