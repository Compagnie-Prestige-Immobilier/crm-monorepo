import type { ApiClient } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import type { DemoStatus } from '@/lib/types';

export async function fetchDemoStatus(client: ApiClient = getApiClient()): Promise<DemoStatus> {
  return unwrap(await client.GET('/api/v1/admin/demo'));
}

export async function resetDemoWorkspace(client: ApiClient = getApiClient()): Promise<DemoStatus> {
  return unwrap(await client.POST('/api/v1/admin/demo/reset'));
}
