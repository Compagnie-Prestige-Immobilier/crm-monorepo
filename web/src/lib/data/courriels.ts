import type { ApiClient } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import type { components } from '@crm/api-client';

import type { Courriel, Paginated, ReglagesCourriels } from '@/lib/types';

export type ReglagesCourrielsLus = components['schemas']['ReglagesCourrielsDTO'];
export type ReglageCourriel = components['schemas']['ReglageCourriel'];
export type TypeReglageCourriel = keyof ReglagesCourriels;

export type ObjetCourriel = 'bank_case' | 'inscription' | 'prospect';
export type TypeCourriel =
  | 'DOSSIER_COMPLET'
  | 'DOSSIER_ENCAISSE'
  | 'DOSSIER_REJETE'
  | 'PROSPECT_ENROLEMENT'
  | 'IMPORT_LEADS';

export const COURRIEL_TYPE_LABELS: Record<string, string> = {
  DOSSIER_COMPLET: 'Dossier complet sur la plateforme',
  DOSSIER_ENCAISSE: 'Dossier bancaire encaissé',
  DOSSIER_REJETE: 'Dossier bancaire rejeté',
  PROSPECT_ENROLEMENT: 'Enrôlement',
  IMPORT_LEADS: 'Relevé des leads',
  FORMULAIRE_PUBLIC: 'Formulaire public',
};

export const COURRIEL_STATUT_LABELS: Record<Courriel['statut'], string> = {
  ENVOYE: 'Envoyé',
  REMIS: 'Remis',
  OUVERT: 'Ouvert',
  ECHEC: 'Échec',
};

export async function fetchCourriels(
  objetType: ObjetCourriel,
  objetId: string,
  client: ApiClient = getApiClient(),
): Promise<Courriel[]> {
  return unwrap(
    await client.GET('/api/v1/courriels/objet/{objetType}/{objetId}', {
      params: { path: { objetType, objetId } },
    }),
  ).items;
}

export async function fetchCourrielsJournal(
  filtres: { type: TypeCourriel | ''; statut: Courriel['statut'] | ''; page: number },
  client: ApiClient = getApiClient(),
): Promise<Paginated<Courriel>> {
  const query: {
    page: number;
    pageSize: number;
    type?: TypeCourriel;
    statut?: Courriel['statut'];
  } = {
    page: filtres.page,
    pageSize: 25,
  };
  if (filtres.type !== '') query.type = filtres.type;
  if (filtres.statut !== '') query.statut = filtres.statut;
  const page = unwrap(await client.GET('/api/v1/courriels', { params: { query } }));
  return { items: page.items, ...page.meta };
}

export async function resendCourriel(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<Courriel> {
  return unwrap(await client.POST('/api/v1/courriels/{id}/renvoyer', { params: { path: { id } } }));
}

export async function fetchReglagesCourriels(
  client: ApiClient = getApiClient(),
): Promise<ReglagesCourrielsLus> {
  return unwrap(await client.GET('/api/v1/courriels/reglages'));
}

export async function saveReglagesCourriels(
  body: ReglagesCourriels,
  client: ApiClient = getApiClient(),
): Promise<ReglagesCourrielsLus> {
  return unwrap(await client.PUT('/api/v1/courriels/reglages', { body }));
}
