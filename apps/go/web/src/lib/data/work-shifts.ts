import { apiClient, unwrap } from '@/api/client';
import type { components } from '@/api/schema';

export type Creneaux = components['schemas']['CreneauxDeTravail'];
export type Creneau = components['schemas']['CreneauDeTravail'];
export type MajCreneaux = components['schemas']['MajCreneauxInputBody'];

export const CLE_CRENEAUX = ['supervision', 'creneaux'] as const;

export async function fetchCreneaux(): Promise<Creneaux> {
  return unwrap(await apiClient.GET('/api/v1/supervision/creneaux'));
}

export async function majCreneaux(body: MajCreneaux): Promise<Creneaux> {
  return unwrap(await apiClient.PUT('/api/v1/supervision/creneaux', { body }));
}
