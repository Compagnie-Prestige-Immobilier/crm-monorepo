import type { ApiClient } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { uuidV7 } from '@/lib/data/console';

/**
 * Miroirs de `OuvertureFicheDto` et `ComptageOuverturesJourDto`, tant que le
 * client engendré ne connaît pas la route : sans eux, tout l'écran d'appel
 * passerait en `any`.
 */
export interface OuvertureFiche {
  id: string;
  openedById: string;
  openedByName: string;
  representantId: string | null;
  prospectId: string | null;
  ficheNom: string;
  openedAt: string;
  closedAt: string | null;
  dureeSecondes: number | null;
  closingAttemptId: string | null;
  draft: Record<string, unknown> | null;
  releasedByName: string | null;
  releasedAt: string | null;
}

export interface ComptageOuvertures {
  openedById: string;
  openedByName: string;
  jour: string;
  ouvertures: number;
  dureeMoyenneSecondes: number | null;
}

export interface OuvrirFicheInput {
  representantId?: string;
  prospectId?: string;
  draft?: Record<string, unknown>;
}

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
  ) as OuvertureFiche;
}

/** La fiche que l'appelant a en main, nulle quand il n'en a aucune. */
export async function fetchOuvertureCourante(
  client: ApiClient = getApiClient(),
): Promise<OuvertureFiche | null> {
  return unwrap(await client.GET('/api/v1/ouvertures/courante')) as OuvertureFiche | null;
}

/**
 * `keepalive` : cette écriture part souvent au moment où l'onglet disparaît, et
 * le navigateur avorte les requêtes d'un document qu'il détruit.
 */
export async function enregistrerBrouillon(
  id: string,
  draft: Record<string, unknown>,
  client: ApiClient = getApiClient(),
): Promise<OuvertureFiche> {
  return unwrap(
    await client.PUT('/api/v1/ouvertures/{id}/brouillon', {
      params: { path: { id } },
      body: { draft },
      keepalive: true,
    }),
  ) as OuvertureFiche;
}

/** Les fiches restées ouvertes : superviseur et administrateur seulement. */
export async function fetchOuverturesOuvertes(
  client: ApiClient = getApiClient(),
): Promise<OuvertureFiche[]> {
  return (unwrap(await client.GET('/api/v1/ouvertures/ouvertes')) as { items: OuvertureFiche[] })
    .items;
}

export async function libererOuverture(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<OuvertureFiche> {
  return unwrap(
    await client.POST('/api/v1/ouvertures/{id}/liberation', { params: { path: { id } } }),
  ) as OuvertureFiche;
}

export async function fetchComptageOuvertures(
  query: { from?: string; to?: string; openedById?: string } = {},
  client: ApiClient = getApiClient(),
): Promise<ComptageOuvertures[]> {
  return (
    unwrap(await client.GET('/api/v1/ouvertures/comptage', { params: { query } })) as {
      items: ComptageOuvertures[];
    }
  ).items;
}

/** Le chronomètre d'EB-09, en secondes pleines depuis l'ouverture confirmée. */
export function secondesEcoulees(openedAt: string, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(openedAt)) / 1000));
}

export function formatChrono(secondes: number): string {
  const minutes = Math.floor(secondes / 60);
  const reste = secondes % 60;
  return `${String(minutes).padStart(2, '0')}:${String(reste).padStart(2, '0')}`;
}
