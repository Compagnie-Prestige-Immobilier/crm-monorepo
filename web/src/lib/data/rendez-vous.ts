import { unwrap } from '@crm/api-client/query';

import { type components } from '@/api/compat/serveur';
import { getApiClient } from '@/lib/api/browser';

export type RendezVousObtenu = components['schemas']['RendezVousObtenu'];
export type ListeRendezVous = components['schemas']['RendezVousListOutputBody'];

export interface FiltresRendezVous {
  type: string | null;
  search: string;
  page: number;
  pageSize: number;
}

export const CLE_RENDEZ_VOUS = ['accueil', 'rendez-vous'] as const;

export async function lireRendezVous(filtres: FiltresRendezVous): Promise<ListeRendezVous> {
  return unwrap(
    await getApiClient().GET('/api/v1/rendez-vous', {
      params: {
        query: {
          ...(filtres.type === null ? {} : { type: filtres.type }),
          ...(filtres.search === '' ? {} : { search: filtres.search }),
          page: filtres.page,
          pageSize: filtres.pageSize,
        },
      },
    }),
  );
}
