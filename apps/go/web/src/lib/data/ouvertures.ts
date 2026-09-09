import { apiClient, unwrap } from '@/api/client';
import type { components } from '@/api/schema';
import { uuidV7 } from '@/lib/data/console';

export type OuvertureFiche = components['schemas']['QualificationOuvertureFicheDTO'];

/**
 * L'identifiant est engendré ici : il sert de clé d'idempotence, et l'ouverture
 * existe sur l'appareil avant d'atteindre le serveur.
 */
export async function ouvrirFiche(cible: {
  representantId?: string;
  prospectId?: string;
}): Promise<OuvertureFiche> {
  return unwrap(
    await apiClient.POST('/api/v1/ouvertures', {
      body: { id: uuidV7(), openedAt: new Date().toISOString(), ...cible },
    }),
  );
}

/**
 * La fiche que l'appelant a en main. Le corps est vide quand il n'en tient
 * aucune : `openapi-fetch` rend alors `data` indéfini sans qu'il y ait panne.
 */
export async function fetchOuvertureCourante(): Promise<OuvertureFiche | null> {
  const { data, error } = await apiClient.GET('/api/v1/ouvertures/courante');
  if (error !== undefined || data === undefined) return null;
  return data;
}

/**
 * `keepalive` : cette écriture part souvent au moment où l'onglet disparaît, et
 * le navigateur avorte les requêtes d'un document qu'il détruit.
 */
export async function enregistrerBrouillon(
  id: string,
  draft: Record<string, unknown>,
  firstInputAt?: string,
): Promise<OuvertureFiche> {
  return unwrap(
    await apiClient.PUT('/api/v1/ouvertures/{id}/brouillon', {
      params: { path: { id } },
      body: { draft, ...(firstInputAt === undefined ? {} : { firstInputAt }) },
      keepalive: true,
    }),
  );
}

export function secondesEcoulees(depuis: string, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(depuis)) / 1000));
}

export function formatChrono(secondes: number): string {
  const minutes = Math.floor(secondes / 60);
  const reste = secondes % 60;
  return `${String(minutes).padStart(2, '0')}:${String(reste).padStart(2, '0')}`;
}
