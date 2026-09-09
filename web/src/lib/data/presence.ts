import { apiClient, unwrap } from '@/api/client';
import type { components } from '@/api/schema';

export type TableauDePresence = components['schemas']['SupervisionOutputBody'];
export type CompteSupervise = components['schemas']['CompteSupervise'];
export type EtatPresence = CompteSupervise['presence'];

export async function fetchPresence(): Promise<TableauDePresence> {
  return unwrap(await apiClient.GET('/api/v1/admin/supervision'));
}
