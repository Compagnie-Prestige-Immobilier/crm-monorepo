import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';

export type AndroidUpdate = components['schemas']['AppUpdateDto'];

export async function fetchAndroidUpdate(
  client: ApiClient = getApiClient(),
): Promise<AndroidUpdate> {
  return unwrap(
    await client.GET('/api/v1/app-updates/android/current', {
      params: { query: { versionCode: 0 } },
    }),
  );
}

export async function uploadAndroidUpdate(
  input: { file: File; forceUpdate: boolean; notes: string },
  client: ApiClient = getApiClient(),
): Promise<AndroidUpdate> {
  const form = new FormData();
  form.append('forceUpdate', String(input.forceUpdate));
  if (input.notes.trim() !== '') form.append('notes', input.notes.trim());
  form.append('file', input.file, input.file.name);

  return unwrap(
    await client.POST('/api/v1/app-updates/android', {
      body: { file: '', forceUpdate: input.forceUpdate },
      bodySerializer: () => form,
    }),
  );
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1_024 * 1_024) return `${String(Math.ceil(bytes / 1_024))} Ko`;
  return `${(bytes / (1_024 * 1_024)).toFixed(1)} Mo`;
}
