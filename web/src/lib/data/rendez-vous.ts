import { unwrap } from '@crm/api-client/query';

import { type components } from '@/api/compat/serveur';
import { getApiClient } from '@/lib/api/browser';

export type RendezVousObtenu = components['schemas']['RendezVousObtenu'];
export type ListeRendezVous = components['schemas']['RendezVousListOutputBody'];

export interface FiltresRendezVous {
  type: string | null;
  search: string;
  issue: string;
  du: string;
  au: string;
  page: number;
  pageSize: number;
}

export const CLE_RENDEZ_VOUS = ['accueil', 'rendez-vous'] as const;

function query(filtres: FiltresRendezVous): Record<string, string | number> {
  return {
    ...(filtres.type === null ? {} : { type: filtres.type }),
    ...(filtres.search === '' ? {} : { search: filtres.search }),
    ...(filtres.issue === '' ? {} : { issue: filtres.issue }),
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
  const params = new URLSearchParams(
    Object.entries(query(filtres)).map(([cle, valeur]) => [cle, String(valeur)]),
  );
  const suffixe = params.toString();
  return `/api/v1/export/rendez-vous.xlsx${suffixe === '' ? '' : `?${suffixe}`}`;
}
