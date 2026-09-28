import { unwrap } from '@crm/api-client/query';

import { type components } from '@/api/compat/serveur';
import { getApiClient } from '@/lib/api/browser';

export type RendezVousObtenu = components['schemas']['RendezVousObtenu'];
export type ListeRendezVous = components['schemas']['RendezVousListOutputBody'];
export type EtapeRendezVous = RendezVousObtenu['etape'];
export type Closing = components['schemas']['Closing'];

export interface FiltresRendezVous {
  etape: EtapeRendezVous;
  type: string;
  search: string;
  du: string;
  au: string;
  page: number;
  pageSize: number;
}

export const CLE_RENDEZ_VOUS = ['accueil', 'rendez-vous'] as const;

function query(filtres: FiltresRendezVous): Record<string, string> {
  return {
    etape: filtres.etape,
    ...(filtres.type === '' ? {} : { type: filtres.type }),
    ...(filtres.search === '' ? {} : { search: filtres.search }),
    ...(filtres.du === '' ? {} : { du: filtres.du }),
    ...(filtres.au === '' ? {} : { au: filtres.au }),
  };
}

export async function lireRendezVous(filtres: FiltresRendezVous): Promise<ListeRendezVous> {
  return unwrap(
    await getApiClient().GET('/api/v1/rendez-vous', {
      params: { query: { ...query(filtres), page: filtres.page, pageSize: filtres.pageSize } },
    }),
  );
}

/** Le classeur se télécharge par le navigateur : la session voyage en cookie. */
export function lienExportRendezVous(filtres: FiltresRendezVous): string {
  return `/api/v1/export/rendez-vous.xlsx?${new URLSearchParams(query(filtres)).toString()}`;
}

export async function lireClosing(id: string): Promise<{ closing: Closing; sites: string[] }> {
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
