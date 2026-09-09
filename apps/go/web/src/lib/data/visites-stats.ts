import { apiClient, unwrap } from '@/api/client';
import type { components } from '@/api/schema';

export type StatsVisites = components['schemas']['StatsVisitesOutputBody'];

export const MOIS_LABELS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

/** Un seul appel nourrit les vingt indicateurs de l'écran, comme en v1. */
export async function fetchStatsVisites(from: string, to: string): Promise<StatsVisites> {
  return unwrap(
    await apiClient.GET('/api/v1/visites/statistiques', { params: { query: { from, to } } }),
  );
}
