import { createApiClient, type ApiClient } from '@crm/api-client';

import { browserApiOrigin } from '@/lib/api/config';
import { redirectToLogin } from '@/lib/api/session-expiry';

/**
 * Client d'API du NAVIGATEUR.
 *
 * Il ne porte aucun jeton : sa base d'URL est l'origine de Next, si bien que
 * `client.GET('/api/v1/prospects')` frappe le relais
 * `src/app/api/v1/[...path]/route.ts` et non NestJS. Le cookie `httpOnly`
 * accompagne la requête, le relais en extrait le jeton et le rattache. Un JWT
 * n'atteint donc jamais le JavaScript de la page, ni la mémoire d'une
 * extension, ni le corps d'un rapport d'erreur.
 *
 * Singleton de module : un onglet, un utilisateur, un client.
 */
let browserClient: ApiClient | undefined;

export function getApiClient(): ApiClient {
  if (typeof window === 'undefined') {
    // Appelé pendant un rendu serveur sans client explicite : la requête
    // partirait vers une URL relative et échouerait de façon opaque
    // (« Failed to parse URL »). On préfère nommer la cause.
    throw new Error(
      'getApiClient() est réservé au navigateur. Côté serveur, passez le client ' +
        'de getServerApiClient() en dernier argument des fonctions de src/lib/data.',
    );
  }
  browserClient ??= createApiClient(browserApiOrigin(), {
    /**
     * Un 401 vu ICI est terminal. Le relais `/api/v1/*` a déjà tenté la
     * rotation côté serveur et effacé les cookies avant de répondre : il n'y a
     * plus de jeton à rafraîchir, et réessayer ne ferait que rejouer l'échec.
     *
     * Sans ce branchement, l'écran restait affiché sur des données périmées et
     * chaque interaction échouait en silence.
     */
    onUnauthorized: () => {
      redirectToLogin();
    },
  });
  return browserClient;
}
