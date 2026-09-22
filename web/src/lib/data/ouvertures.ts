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
  firstInputAt: string | null;
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
  qualifiees: number;
  liberees: number;
  dureeMoyenneSecondes: number | null;
  ouverturesDejaQualifiees: number;
  requalifiees: number;
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

export type CibleOuverture = 'representant' | 'prospect';

/** La fiche que l'appelant a en main, dans une console ou dans l'autre ; nulle sans fiche. */
export async function fetchOuvertureCourante(
  cible?: CibleOuverture,
  client: ApiClient = getApiClient(),
): Promise<OuvertureFiche | null> {
  return unwrap(
    await client.GET('/api/v1/ouvertures/courante', {
      params: { query: cible === undefined ? {} : { cible } },
    }),
  ) as OuvertureFiche | null;
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

export function secondesEcoulees(depuis: string, now: number): number {
  return Math.max(0, Math.floor((now - Date.parse(depuis)) / 1000));
}

export function formatChrono(secondes: number): string {
  const minutes = Math.floor(secondes / 60);
  const reste = secondes % 60;
  return `${String(minutes).padStart(2, '0')}:${String(reste).padStart(2, '0')}`;
}
