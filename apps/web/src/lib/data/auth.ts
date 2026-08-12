import type { ApiClient } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import type { Role, SessionUser } from '@/lib/types';

/** Les deux rôles du siège. Le COMMERCIAL est refusé à la porte. */
export const PANEL_ROLES: readonly Role[] = ['ADMIN', 'BANQUE_FINANCE'];

/**
 * Couche d'authentification — `POST /auth/login`, `GET /auth/me`,
 * `POST /auth/logout` du client généré.
 *
 * Ce qui n'est PAS un détail d'implémentation : les jetons ne traversent jamais
 * la frontière du serveur. Ils sont posés dans des cookies `httpOnly`, donc
 * invisibles pour `document.cookie` et pour tout script injecté. Un jeton rangé
 * dans `localStorage` est lisible par la première XSS venue, et l'admin CPI voit
 * toute la base de prospects.
 *
 * Toutes les fonctions passent par `unwrap()`. `openapi-fetch` ne lève JAMAIS :
 * sans lui, un 401 se présenterait comme une réussite dont les données sont
 * `undefined`, et l'écran de connexion afficherait un tableau de bord vide.
 */

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Durée de vie en secondes, telle que renvoyée par le backend. */
  accessTokenTtl: number;
  refreshTokenTtl: number;
}

export interface LoginResult {
  tokens: AuthTokens;
  user: SessionUser;
}

/** `JWT_REFRESH_TTL_DAYS` côté API. */
const REFRESH_TTL = 30 * 24 * 60 * 60;

/**
 * Le contrat exige `user-agent` sur `/auth/login` et `/auth/refresh` : le
 * backend le journalise avec la famille de refresh tokens, pour qu'un
 * administrateur puisse reconnaître l'appareil d'une session révoquée.
 */
const PANEL_USER_AGENT = 'cpi-go-admin-panel';

/**
 * `null` = identifiants refusés. On ne distingue PAS « compte inconnu » de
 * « mot de passe faux » ni de « compte désactivé » : la réponse ne doit pas
 * permettre d'énumérer les comptes existants.
 *
 * Un 429 (trop de tentatives) ou un 500 remontent en revanche comme des
 * exceptions : ce ne sont pas des identifiants invalides, et dire « mot de
 * passe incorrect » à quelqu'un qui vient d'être limité en débit l'enverrait
 * réessayer indéfiniment.
 */
export async function authenticate(
  identifier: string,
  password: string,
  client: ApiClient,
): Promise<LoginResult | null> {
  const result = await client.POST('/api/v1/auth/login', {
    params: { header: { 'user-agent': PANEL_USER_AGENT } },
    body: { identifier, password },
  });

  if (result.response.status === 401) return null;

  const payload = unwrap(result);

  // Le panel est réservé au siège : ADMIN et BANQUE_FINANCE. Un COMMERCIAL a
  // l'application mobile ; le laisser entrer ici lui donnerait la liste
  // complète des prospects, alors que son métier tient dans un annuaire de
  // téléphones sans nom (voir `DirectoryEntryDto` côté API).
  if (!PANEL_ROLES.includes(payload.user.role)) return null;

  return {
    tokens: {
      accessToken: payload.accessToken,
      refreshToken: payload.refreshToken,
      accessTokenTtl: payload.expiresIn,
      refreshTokenTtl: REFRESH_TTL,
    },
    user: payload.user,
  };
}

/** `GET /auth/me`. Le jeton est rattaché par le client, pas par l'appelant. */
export async function fetchSessionUser(client: ApiClient = getApiClient()): Promise<SessionUser> {
  return unwrap(await client.GET('/api/v1/auth/me'));
}

/** `POST /auth/logout` — révoque toute la famille de refresh tokens. */
export async function revokeSession(refreshToken: string, client: ApiClient): Promise<void> {
  await client.POST('/api/v1/auth/logout', { body: { refreshToken } });
}
