import type { ApiClient } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import type { VisiteStats } from '@/components/accueil/tableau-de-bord/sources';

export {
  fetchDisposition,
  resetDisposition,
  saveDefaultDisposition,
  saveDisposition,
  serializeDisposition,
  type DashboardWidget,
} from '@/lib/data/disposition';

export async function fetchVisiteDashboardStats(
  du: string,
  au: string,
  client: ApiClient = getApiClient(),
): Promise<VisiteStats> {
  return unwrap(
    await client.GET('/api/v1/visites/statistiques', { params: { query: { from: du, to: au } } }),
  );
}
