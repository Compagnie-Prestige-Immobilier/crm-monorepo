import 'server-only';

import { createApiClient, type ApiClient } from '@crm/api-client';
import { cookies } from 'next/headers';
import { cache } from 'react';

import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
  serverApiOrigin,
} from '@/lib/api/config';
import {
  rotateRefreshTokenDetailed,
  type RotatedTokens,
} from '@/lib/api/tokens';

/**
 * Client d'API CÔTÉ SERVEUR — rendu des pages, Route Handlers, Server Actions.
 *
 * Deux responsabilités que rien d'autre n'assume :
 *
 * 1. Rattacher le jeton d'accès lu dans le cookie `httpOnly`. Le navigateur ne
 *    peut pas le faire : il ne voit pas le cookie.
 * 2. Rejouer UNE fois après un 401, avec un jeton fraîchement tourné. Sans
 *    cela, la quinzième minute d'une session déconnecte l'utilisateur au
 *    milieu d'un écran, alors que son refresh token est valable trente jours.
 *
 * La rotation est faite dans le `fetch` injecté plutôt que dans le middleware
 * `onUnauthorized` de `@crm/api-client` : ce dernier voit la réponse mais ne
 * peut pas relancer la requête, et un rafraîchissement sans rejeu ne répare
 * rien du point de vue de l'utilisateur.
 */

/** Levée quand la famille de refresh tokens est morte. L'appelant redirige. */
export class SessionExpiredError extends Error {
  constructor() {
    super('Session expirée. Reconnectez-vous.');
    this.name = 'SessionExpiredError';
  }
}

export class SessionUnavailableError extends Error {
  constructor() {
    super('Le serveur CPI est momentanément injoignable.');
    this.name = 'SessionUnavailableError';
  }
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Durée de vie en secondes, telle que renvoyée par le backend. */
  accessTokenTtl: number;
  refreshTokenTtl: number;
}

export function toAuthTokens(rotated: RotatedTokens): AuthTokens {
  return {
    accessToken: rotated.accessToken,
    refreshToken: rotated.refreshToken,
    accessTokenTtl: rotated.expiresIn,
    refreshTokenTtl: REFRESH_TTL_SECONDS,
  };
}

const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
} as const;

export async function getAccessToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACCESS_COOKIE)?.value ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(REFRESH_COOKIE)?.value ?? null;
}

/**
 * `true` si l'écriture a abouti.
 *
 * Next refuse d'écrire un cookie pendant le rendu d'un composant serveur : les
 * en-têtes sont déjà partis. Ce n'est pas une anomalie — le middleware tourne
 * les jetons AVANT le rendu, et la voie réactive (Route Handlers, Server
 * Actions) écrit normalement. On rend l'échec à l'appelant au lieu de faire
 * tomber la page.
 */
export async function setSessionCookies(tokens: AuthTokens): Promise<boolean> {
  try {
    const store = await cookies();
    store.set(ACCESS_COOKIE, tokens.accessToken, {
      ...cookieOptions,
      maxAge: tokens.accessTokenTtl,
    });
    store.set(REFRESH_COOKIE, tokens.refreshToken, {
      ...cookieOptions,
      maxAge: tokens.refreshTokenTtl,
    });
    return true;
  } catch {
    return false;
  }
}

export async function clearSessionCookies(): Promise<boolean> {
  try {
    const store = await cookies();
    store.set(ACCESS_COOKIE, '', { ...cookieOptions, maxAge: 0 });
    store.set(REFRESH_COOKIE, '', { ...cookieOptions, maxAge: 0 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Jeton tourné pendant CETTE requête, quand le cookie n'a pas pu être réécrit.
 *
 * `cache()` mémorise par passe de rendu serveur, donc par requête HTTP. Un
 * simple `let` de module serait partagé par toutes les requêtes du processus :
 * le jeton d'un administrateur servirait la requête suivante, d'un autre
 * utilisateur. C'est une fuite inter-comptes, pas une optimisation.
 */
const requestTokenOverride = cache((): { value: string | null } => ({ value: null }));

/**
 * Rafraîchit une fois et mémorise le résultat pour le reste de la requête.
 * Les appels concurrents d'un même rendu partagent la même promesse : sans
 * cela, six requêtes parallèles rejoueraient six fois le même refresh token, et
 * la détection de rejeu du backend tuerait la famille entière.
 */
const refreshOnce = cache(async (): Promise<AuthTokens | null> => {
  const refreshToken = await getRefreshToken();
  if (refreshToken === null || refreshToken === '') return null;

  const rotation = await rotateRefreshTokenDetailed(serverApiOrigin(), refreshToken);
  if (!rotation.ok && rotation.reason === 'unavailable') {
    throw new SessionUnavailableError();
  }
  if (!rotation.ok) {
    await clearSessionCookies();
    return null;
  }

  const tokens = toAuthTokens(rotation.tokens);
  const persisted = await setSessionCookies(tokens);
  if (!persisted) requestTokenOverride().value = tokens.accessToken;
  return tokens;
});

/**
 * `fetch` qui tente une rotation puis un rejeu sur 401.
 *
 * La requête est clonée AVANT d'être consommée : un corps déjà lu ne se rejoue
 * pas, et un POST de fusion de prospects perdu à la quinzième minute est
 * exactement le genre de bug qu'on ne reproduit jamais en développement.
 */
const fetchWithRotation: typeof globalThis.fetch = async (input, init) => {
  const request = new Request(input, init);
  const replay = request.clone();

  const response = await globalThis.fetch(request);
  if (response.status !== 401) return response;

  const tokens = await refreshOnce();
  if (tokens === null) throw new SessionExpiredError();

  replay.headers.set('Authorization', `Bearer ${tokens.accessToken}`);
  return globalThis.fetch(replay);
};

/**
 * Un client par requête. `cache()` garantit que les six préchargements d'une
 * même page partagent le même client — donc le même verrou de rotation.
 */
export const getServerApiClient = cache((): ApiClient =>
  createApiClient(serverApiOrigin(), {
    getAccessToken: async () => requestTokenOverride().value ?? (await getAccessToken()),
    fetch: fetchWithRotation,
  }),
);

/**
 * Client NON authentifié, pour `POST /auth/login` : le seul appel qui ne doit
 * pas porter de jeton, et qui ne doit surtout pas déclencher de rotation.
 */
export function getAnonymousApiClient(): ApiClient {
  return createApiClient(serverApiOrigin());
}
