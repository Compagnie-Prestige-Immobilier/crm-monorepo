import { NextResponse, type NextProxy } from 'next/server';

import {
  ACCESS_COOKIE,
  ApiConfigurationError,
  REFRESH_COOKIE,
  REFRESH_TTL_SECONDS,
  serverApiOrigin,
} from '@/lib/api/config';
import { isAccessTokenStale, rotateRefreshTokenDetailed } from '@/lib/api/tokens';

/**
 * Rotation ANTICIPÉE des jetons (`proxy.ts`, ex-`middleware.ts`).
 *
 * Pourquoi ici et pas seulement dans le client serveur : un composant serveur
 * ne peut PAS écrire de cookie : au moment où il s'exécute, les en-têtes de
 * réponse sont déjà partis. Or l'API fait tourner le refresh token à chaque
 * usage. Un rafraîchissement déclenché pendant un rendu obtiendrait donc un
 * jeton neuf sans pouvoir le ranger : le cookie garderait l'ancien, que le
 * backend vient d'invalider, et la session mourrait au chargement suivant.
 *
 * Ce fichier tourne AVANT le rendu, sur le runtime Node.js (garanti par la
 * convention `proxy.ts` de Next 16 : donc `process.env.API_URL` est lu à
 * l'exécution, pas figé au build). Il réécrit les cookies de la requête ET de
 * la réponse : le rendu qui suit voit déjà le jeton neuf.
 *
 * Le rejeu réactif sur 401 reste en place dans `src/lib/api/server.ts` et dans
 * le relais `/api/v1/*` : il couvre la révocation d'un compte en cours de
 * session, que l'anticipation ne peut pas prévoir.
 */

const proxy: NextProxy = async (request) => {
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;

  // Pas de session, ou jeton encore frais : on ne touche à rien. Le coût de ce
  // chemin est une lecture de cookie et un décodage base64.
  if (refresh === undefined || refresh === '') return NextResponse.next();
  if (!isAccessTokenStale(access)) return NextResponse.next();

  /**
   * `API_URL` absent : on ne tourne rien et on laisse passer.
   *
   * Lever ici ferait répondre 500 à CHAQUE requête du panel, y compris à
   * l'écran de connexion : le seul endroit où le défaut de configuration peut
   * encore être nommé. Le message utile serait remplacé par une page d'erreur
   * muette. Les Route Handlers, eux, répondent avec la variable manquante.
   */
  let origin: string;
  try {
    origin = serverApiOrigin();
  } catch (error) {
    if (error instanceof ApiConfigurationError) return NextResponse.next();
    throw error;
  }

  const rotation = await rotateRefreshTokenDetailed(origin, refresh);

  if (!rotation.ok && rotation.reason === 'unavailable') {
    // Une panne réseau n'est pas une session morte. Garder les cookies permet
    // au prochain chargement de retenter la rotation quand l'API revient.
    return NextResponse.next();
  }

  if (!rotation.ok) {
    // Famille de jetons morte (révoquée, expirée ou rejouée). Effacer plutôt
    // que rediriger d'ici évite de casser une requête de données en cours avec
    // une redirection HTML.
    const response = NextResponse.next();
    response.cookies.delete(ACCESS_COOKIE);
    response.cookies.delete(REFRESH_COOKIE);
    return response;
  }

  // Réécriture côté REQUÊTE : sans elle, le rendu qui suit lirait encore
  // l'ancien jeton dans `cookies()` et repartirait pour un 401.
  request.cookies.set(ACCESS_COOKIE, rotation.tokens.accessToken);
  request.cookies.set(REFRESH_COOKIE, rotation.tokens.refreshToken);

  const response = NextResponse.next({ request });
  const options = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  } as const;

  response.cookies.set(ACCESS_COOKIE, rotation.tokens.accessToken, {
    ...options,
    maxAge: rotation.tokens.expiresIn,
  });
  response.cookies.set(REFRESH_COOKIE, rotation.tokens.refreshToken, {
    ...options,
    maxAge: REFRESH_TTL_SECONDS,
  });

  return response;
};

export default proxy;

export const config = {
  matcher: [
    /**
     * Tout sauf les ressources statiques et `/api/auth/*`.
     *
     * `/api/auth/login` et `/api/auth/logout` posent et effacent les cookies
     * eux-mêmes ; une rotation concurrente pendant une déconnexion réécrirait
     * les cookies que le handler vient de vider.
     */
    '/((?!_next/static|_next/image|api/auth|brand|favicon.ico).*)',
  ],
};
