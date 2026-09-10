import { createApiClient, type ApiClient } from '@crm/api-client';

import { redirectToLogin } from '@/lib/api/session-expiry';

let browserClient: ApiClient | undefined;

export function getApiClient(): ApiClient {
  if (browserClient === undefined) {
    browserClient = createApiClient();
    browserClient.use({
      onResponse({ response }) {
        if (response.status === 401) redirectToLogin();
        return response;
      },
    });
  }
  return browserClient;
}
