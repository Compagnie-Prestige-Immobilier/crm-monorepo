import { API_PREFIX, REFRESH_SKEW_SECONDS } from '@/lib/api/config';

/**
 * Rotation des jetons — mécanique pure, sans dépendance à `next/headers`.
 *
 * Ce module est partagé par le middleware (rafraîchissement anticipé), le
 * relais `/api/v1/*` (rafraîchissement réactif sur 401) et le client serveur.
 * Il ne touche à aucun cookie : les trois appelants n'écrivent pas au même
 * endroit, et mélanger les deux responsabilités rendait le tout intestable.
 */

export interface RotatedTokens {
  accessToken: string;
  refreshToken: string;
  /** Durée de vie de l'access token en secondes, telle que renvoyée par l'API. */
  expiresIn: number;
}

/**
 * Le backend fait tourner un refresh token et invalide l'ancien. Une page
 * charge plusieurs données en parallèle : sans ce verrou, ces requêtes
 * présentent toutes le même token, et le deuxième appel est pris pour un
 * rejeu. La clé est le token lui-même : les sessions distinctes ne se
 * bloquent pas entre elles.
 */
const inFlightRotations = new Map<string, Promise<RefreshRotationResult>>();

export type RefreshRotationResult =
  | { ok: true; tokens: RotatedTokens }
  | { ok: false; reason: 'invalid' | 'unavailable' };

/**
 * Lit `exp` d'un JWT SANS vérifier sa signature.
 *
 * C'est volontaire et c'est sans risque ici : la valeur ne sert qu'à décider
 * s'il faut rafraîchir avant d'envoyer la requête. L'autorité reste l'API, qui
 * vérifie la signature à chaque appel. Un jeton falsifié avec un `exp` lointain
 * ne gagne rien — il se fera rejeter en 401 et la voie réactive prendra le
 * relais.
 */
export function readJwtExpiry(token: string): number | null {
  const payload = token.split('.')[1];
  if (payload === undefined || payload === '') return null;
  try {
    const base64 = payload.replaceAll('-', '+').replaceAll('_', '/');
    const json = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='));
    const claims: unknown = JSON.parse(json);
    if (typeof claims !== 'object' || claims === null) return null;
    const { exp } = claims as { exp?: unknown };
    return typeof exp === 'number' ? exp : null;
  } catch {
    // Jeton tronqué, non-JWT, base64 invalide : traité comme « expiration
    // inconnue », donc à rafraîchir. Ne jamais laisser une chaîne mal formée
    // faire échouer le rendu.
    return null;
  }
}

/**
 * `true` si le jeton est absent, illisible, expiré, ou sur le point de l'être.
 * Un jeton dont l'expiration est inconnue est considéré comme périmé : mieux
 * vaut un rafraîchissement inutile qu'un 401 au milieu d'un rendu.
 */
export function isAccessTokenStale(token: string | null | undefined, now = Date.now()): boolean {
  if (token === null || token === undefined || token === '') return true;
  const exp = readJwtExpiry(token);
  if (exp === null) return true;
  return exp - REFRESH_SKEW_SECONDS <= Math.floor(now / 1000);
}

/**
 * Échange un refresh token contre un couple neuf.
 *
 * `null` signifie « cette famille de jetons est morte » : jeton révoqué,
 * expiré, ou rejoué. L'appelant doit alors effacer les cookies et renvoyer
 * vers `/connexion` — surtout pas réessayer, le serveur invalide toute la
 * famille au premier rejeu détecté.
 */
export async function rotateRefreshToken(
  origin: string,
  refreshToken: string,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<RotatedTokens | null> {
  const result = await rotateRefreshTokenDetailed(origin, refreshToken, fetchImpl);
  return result.ok ? result.tokens : null;
}

/**
 * Même rotation, mais sans perdre la différence entre « session morte » et
 * « réseau momentanément indisponible ». Les appelants qui gèrent des cookies
 * doivent conserver cette différence : effacer une session valide pendant une
 * panne réseau est la déconnexion prématurée observée en production.
 */
export async function rotateRefreshTokenDetailed(
  origin: string,
  refreshToken: string,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<RefreshRotationResult> {
  if (refreshToken === '') return { ok: false, reason: 'invalid' };

  const running = inFlightRotations.get(refreshToken);
  if (running !== undefined) return running;

  const rotation = rotateRefreshTokenOnce(origin, refreshToken, fetchImpl);
  inFlightRotations.set(refreshToken, rotation);
  try {
    return await rotation;
  } finally {
    inFlightRotations.delete(refreshToken);
  }
}

async function rotateRefreshTokenOnce(
  origin: string,
  refreshToken: string,
  fetchImpl: typeof globalThis.fetch,
): Promise<RefreshRotationResult> {
  let response: Response;
  try {
    response = await fetchImpl(`${origin}${API_PREFIX}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
  } catch {
    // Backend injoignable. On ne détruit PAS la session pour une panne réseau :
    // l'appelant renverra une erreur temporaire, et le jeton restera valable
    // quand le réseau reviendra.
    return { ok: false, reason: 'unavailable' };
  }

  if (!response.ok) return { ok: false, reason: 'invalid' };

  try {
    const body: unknown = await response.json();
    if (typeof body !== 'object' || body === null) return null;
    const { accessToken, refreshToken: next, expiresIn } = body as Record<string, unknown>;
    if (typeof accessToken !== 'string' || typeof next !== 'string') {
      return { ok: false, reason: 'invalid' };
    }
    return {
      ok: true,
      tokens: {
        accessToken,
        refreshToken: next,
        expiresIn: typeof expiresIn === 'number' ? expiresIn : 900,
      },
    };
  } catch {
    return { ok: false, reason: 'invalid' };
  }
}
