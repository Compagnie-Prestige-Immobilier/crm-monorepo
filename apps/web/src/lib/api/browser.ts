import { createApiClient, type ApiClient } from '@crm/api-client';

import { browserApiOrigin } from '@/lib/api/config';
import { redirectToLogin } from '@/lib/api/session-expiry';

let browserClient: ApiClient | undefined;

export function getApiClient(): ApiClient {
  if (typeof window === 'undefined') {
    throw new Error(
      'getApiClient() est réservé au navigateur. Côté serveur, passez le client ' +
        'de getServerApiClient() en dernier argument des fonctions de src/lib/data.',
    );
  }
  browserClient ??= createApiClient(browserApiOrigin(), {
    onUnauthorized: () => {
      redirectToLogin();
    },
  });
  return browserClient;
}
