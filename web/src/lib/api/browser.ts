import { createApiClient, type ApiClient } from '@crm/api-client';

import { redirectToLogin } from '@/lib/api/session-expiry';
import { noterVersionPanneau } from '@/lib/api/version-panneau';

let browserClient: ApiClient | undefined;

export function getApiClient(): ApiClient {
  if (browserClient === undefined) {
    browserClient = createApiClient();
    browserClient.use({
      onResponse({ response }) {
        noterVersionPanneau(response);
        if (response.status === 401) redirectToLogin();
        return response;
      },
    });
  }
  return browserClient;
}
