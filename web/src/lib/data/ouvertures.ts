import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { uuidV7 } from '@/lib/data/console';

export type OuvertureFiche = components['schemas']['QualificationOuvertureFicheDTO'];
export type ComptageOuvertures = components['schemas']['QualificationComptageJourDTO'];
type OuvrirFicheInput = Omit<
  components['schemas']['QualificationOuvrirFicheInputBody'],
  'id' | 'openedAt'
>;

/**
 * L'identifiant est engendré ici : il sert de clé d'idempotence, et l'ouverture
 * existe sur l'appareil avant d'atteindre le serveur.
 */
export async function ouvrirFiche(
  input: OuvrirFicheInput,
  client: ApiClient = getApiClient(),
): Promise<OuvertureFiche> {
  return unwrap(
    await client.POST('/api/v1/ouvertures', {
      body: { id: uuidV7(), openedAt: new Date().toISOString(), ...input },
    }),
  );
}

/**
 * `keepalive` : cette écriture part souvent au moment où l'onglet disparaît, et
 * le navigateur avorte les requêtes d'un document qu'il détruit.
 */
export async function enregistrerBrouillon(
  id: string,
  draft: Record<string, unknown>,
  firstInputAt?: string,
  client: ApiClient = getApiClient(),
): Promise<OuvertureFiche> {
  return unwrap(
    await client.PUT('/api/v1/ouvertures/{id}/brouillon', {
      params: { path: { id } },
      body: { draft, ...(firstInputAt === undefined ? {} : { firstInputAt }) },
      keepalive: true,
    }),
  );
}

export async function fetchComptageOuvertures(
  query: { from?: string; to?: string; openedById?: string } = {},
  client: ApiClient = getApiClient(),
): Promise<ComptageOuvertures[]> {
  return unwrap(await client.GET('/api/v1/ouvertures/comptage', { params: { query } })).items;
}

export function secondesEcoulees(depuis: string, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(depuis)) / 1000));
}

export function formatChrono(secondes: number): string {
  const minutes = Math.floor(secondes / 60);
  const reste = secondes % 60;
  return `${String(minutes).padStart(2, '0')}:${String(reste).padStart(2, '0')}`;
}
