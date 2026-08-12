import 'server-only';

import { ApiError } from '@crm/api-client/query';

import { ACCESS_COOKIE, REFRESH_COOKIE } from '@/lib/api/config';
import { SessionExpiredError, getServerApiClient } from '@/lib/api/server';
import { fetchSessionUser } from '@/lib/data/auth';
import type { SessionUser } from '@/lib/types';

/**
 * Session du panel — surface publique côté serveur.
 *
 * Le stockage lui-même (cookies `httpOnly`, rotation du refresh token) vit dans
 * `src/lib/api/server.ts`, avec le client qui les consomme : séparer les deux
 * fabriquait un cycle d'imports et, surtout, deux endroits où lire le même
 * cookie.
 *
 * `httpOnly` retire le jeton de la portée de JavaScript : ni `document.cookie`,
 * ni un script tiers compromis, ni une extension ne peuvent le lire. C'est la
 * seule protection qui tienne contre une XSS ; un jeton en `localStorage` est
 * exfiltré en une ligne.
 *
 * `import 'server-only'` fait échouer le BUILD si un composant client importe
 * ce module par erreur. Une erreur d'exécution en production serait trop tard.
 */

export { ACCESS_COOKIE, REFRESH_COOKIE };
export {
  clearSessionCookies,
  getAccessToken,
  getRefreshToken,
  setSessionCookies,
  toAuthTokens,
  type AuthTokens,
} from '@/lib/api/server';

/**
 * Résultat d'une lecture de session.
 *
 * Le booléen ne suffisait pas : « l'API dit que ce jeton ne vaut rien » et
 * « l'API n'a pas répondu » exigent deux réactions opposées, et les confondre
 * a un coût mesuré (voir `getSession`).
 */
export type SessionResult =
  | { status: 'authenticated'; user: SessionUser }
  /** L'API a formellement rejeté le jeton : 401 ou 403. Il faut se reconnecter. */
  | { status: 'anonymous' }
  /** L'API est indisponible (429, 5xx, réseau). La session n'est PAS en cause. */
  | { status: 'unavailable'; error: unknown };

/**
 * Lecture de session détaillée. Ne lève jamais.
 *
 * Défaut corrigé ici, observé en conditions réelles : la version précédente
 * avalait TOUTE exception et renvoyait `null`, que le jeton soit refusé ou que
 * l'API soit simplement injoignable. Conséquence constatée dans les journaux —
 * `GET /auth/me` répond 429 (limiteur de débit de l'API, 300 req/min), la
 * session est déclarée absente, et `/tableau-de-bord` renvoie un 307 vers
 * `/connexion` alors que les DEUX cookies sont valides.
 *
 * Le pire est la boucle : l'administrateur, éjecté, se reconnecte — ce qui
 * consomme le quota de connexion (10/min) — et se fait éjecter de nouveau. Une
 * pointe de charge devient une panne d'authentification totale.
 */
export async function readSession(): Promise<SessionResult> {
  try {
    return { status: 'authenticated', user: await fetchSessionUser(getServerApiClient()) };
  } catch (error) {
    // Seul un refus explicite de l'API vaut « pas de session ». `unwrap()`
    // préserve `.status`, et c'est précisément à cela qu'il sert ici.
    if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
      return { status: 'anonymous' };
    }
    if (error instanceof SessionExpiredError) return { status: 'anonymous' };
    // 429, 500, backend éteint, `API_URL` absent : ne PAS détruire la session.
    return { status: 'unavailable', error };
  }
}

/**
 * `null` si la session est absente ou invalide. Ne lève jamais.
 *
 * Conserve l'ancienne sémantique pour les appelants qui n'ont qu'un rendu
 * binaire à faire (l'écran de connexion, qui redirige un administrateur déjà
 * authentifié). Une API indisponible y compte comme « pas de session », ce qui
 * est le bon défaut : mieux vaut présenter le formulaire que rien.
 */
export async function getSession(): Promise<SessionUser | null> {
  const result = await readSession();
  return result.status === 'authenticated' ? result.user : null;
}

/**
 * Session d'un ADMIN, ou `null`.
 *
 * Le panel entier est réservé au siège, mais la gestion des comptes l'est
 * doublement : `GET /users` répond 403 à un COMMERCIAL. On coupe donc côté
 * serveur plutôt que de laisser l'écran se construire puis échouer.
 */
export async function getAdminSession(): Promise<SessionUser | null> {
  const session = await getSession();
  return session !== null && session.role === 'ADMIN' ? session : null;
}

/**
 * Garde de rôle pour une page serveur.
 *
 * Trois issues, et elles ne se confondent pas :
 *  - `null` : pas de session — l'appelant redirige vers `/connexion` ;
 *  - `{ denied: true }` : session valide, rôle insuffisant — l'appelant rend un
 *    refus explicite, PAS une redirection. Rebondir vers l'accueil laisserait
 *    croire à un lien mort là où la vraie réponse est « ce n'est pas votre
 *    écran » ;
 *  - la session, sinon.
 *
 * Le masquage de la navigation (`components/layout/nav-items.ts`) ne remplace
 * jamais ce contrôle : une URL se tape à la main, et un onglet resté ouvert
 * après un changement de rôle rejoue l'ancienne route.
 */
export type RoleGuard =
  | { status: 'anonymous' }
  | { status: 'denied'; user: SessionUser }
  | { status: 'allowed'; user: SessionUser };

export async function guardRoles(allowed: readonly SessionUser['role'][]): Promise<RoleGuard> {
  const session = await getSession();
  if (session === null) return { status: 'anonymous' };
  return allowed.includes(session.role)
    ? { status: 'allowed', user: session }
    : { status: 'denied', user: session };
}
