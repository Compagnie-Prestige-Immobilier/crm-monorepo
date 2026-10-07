import { unwrap } from '@crm/api-client/query';

import { type components } from '@/api/compat/serveur';
import type { paths } from '@/api/schema';
import { getApiClient } from '@/lib/api/browser';

export type RendezVousObtenu = components['schemas']['RendezVousObtenu'];
export type ListeRendezVous = components['schemas']['RendezVousListOutputBody'];
export type SyntheseRendezVous = components['schemas']['RendezVousSyntheseOutputBody'];
export type Closing = components['schemas']['Closing'];

export interface FiltresRendezVous {
  historique: boolean;
  type: string;
  search: string;
  page: number;
}

export const RENDEZ_VOUS_PAR_PAGE = 100;

export const CLE_RENDEZ_VOUS = ['accueil', 'rendez-vous'] as const;

function query(filtres: FiltresRendezVous): Record<string, string> {
  return {
    etape: filtres.historique ? 'HISTORIQUE' : 'A_TRAITER',
    ...(filtres.type === '' ? {} : { type: filtres.type }),
    ...(filtres.search === '' ? {} : { search: filtres.search }),
  };
}

export async function lireRendezVous(filtres: FiltresRendezVous): Promise<ListeRendezVous> {
  return unwrap(
    await getApiClient().GET('/api/v1/rendez-vous', {
      params: { query: { ...query(filtres), page: filtres.page, pageSize: RENDEZ_VOUS_PAR_PAGE } },
    }),
  );
}

/** Une semaine d'agenda tient sous la borne de l'API ; `total` dit si elle déborde. */
export async function lireRendezVousEntre(du: string, au: string): Promise<ListeRendezVous> {
  return unwrap(
    await getApiClient().GET('/api/v1/rendez-vous', {
      params: { query: { du, au, page: 1, pageSize: 200 } },
    }),
  );
}

/** Le classeur se télécharge par le navigateur : la session voyage en cookie. */
export function lienExportRendezVous(filtres: FiltresRendezVous): string {
  return `/api/v1/export/rendez-vous.xlsx?${new URLSearchParams(query(filtres)).toString()}`;
}

export async function lireClosing(id: string): Promise<{
  closing: Closing;
  sites: string[];
  chargesDeClientele: string[];
  pointsRencontre: string[];
}> {
  return unwrap(
    await getApiClient().GET('/api/v1/prospects/{id}/closing', { params: { path: { id } } }),
  );
}

export async function enregistrerClosing(id: string, closing: Closing): Promise<void> {
  unwrap(
    await getApiClient().PUT('/api/v1/prospects/{id}/closing', {
      params: { path: { id } },
      body: closing,
    }),
  );
}

export async function lireSyntheseRendezVous(
  type: string,
  du: string,
  au: string,
): Promise<SyntheseRendezVous> {
  return unwrap(
    await getApiClient().GET('/api/v1/rendez-vous/synthese', {
      params: { query: { ...(type === '' ? {} : { type }), du, au } },
    }),
  );
}

export type EtapeRendezVous = NonNullable<
  NonNullable<paths['/api/v1/rendez-vous']['get']['parameters']['query']>['etape']
>;

export interface FiltresSynthese {
  etape: EtapeRendezVous;
  reporte: boolean;
  type: string;
  du: string;
  au: string;
}

export const RENDEZ_VOUS_PAR_PAGE_SYNTHESE = 20;

export async function lireRendezVousDeLaSynthese(
  filtres: FiltresSynthese,
  page: number,
): Promise<ListeRendezVous> {
  return unwrap(
    await getApiClient().GET('/api/v1/rendez-vous', {
      params: {
        query: {
          ...(filtres.etape === '' ? {} : { etape: filtres.etape }),
          ...(filtres.type === '' ? {} : { type: filtres.type }),
          ...(filtres.du === '' ? {} : { du: filtres.du }),
          ...(filtres.au === '' ? {} : { au: filtres.au }),
          reporte: filtres.reporte,
          recontacterCompris: true,
          page,
          pageSize: RENDEZ_VOUS_PAR_PAGE_SYNTHESE,
        },
      },
    }),
  );
}
