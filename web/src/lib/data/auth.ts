import type { ApiClient } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import type { SessionUser } from '@/lib/types';

export async function fetchSessionUser(client: ApiClient = getApiClient()): Promise<SessionUser> {
  return unwrap(await client.GET('/api/v1/auth/me'));
}

export async function changeMyPassword(
  currentPassword: string,
  newPassword: string,
  client: ApiClient = getApiClient(),
): Promise<void> {
  unwrap(await client.PUT('/api/v1/auth/me/password', { body: { currentPassword, newPassword } }));
}
