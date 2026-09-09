import { apiClient, unwrap } from '@/api/client';
import type { components } from '@/api/schema';
import type { ProjetApi } from '@/lib/types';

export type Inscription = components['schemas']['Inscription'];
export type ReglagesEnrolement = components['schemas']['ReglagesOutputBody'];
export type IndicateursEnrolement = components['schemas']['IndicateursOutputBody'];
export type Tirage = components['schemas']['TirageOutputBody'];
export type PageEnrolement = components['schemas']['PageAdmin'];
export type BilanTirage = components['schemas']['BilanTirage'];

export interface FiltresInscriptions {
  page: number;
  pageSize: number;
  search: string;
  statut: string | null;
  rapproche: boolean | null;
  inclureDisparues: boolean;
  dateFrom: string;
  dateTo: string;
}

export const FILTRES_INSCRIPTIONS_VIDES: FiltresInscriptions = {
  page: 1,
  pageSize: 25,
  search: '',
  statut: null,
  rapproche: null,
  inclureDisparues: false,
  dateFrom: '',
  dateTo: '',
};

type Requete = Record<string, string | number | boolean>;

function periode(filtres: FiltresInscriptions): Requete {
  return {
    ...(filtres.dateFrom === '' ? {} : { dateFrom: filtres.dateFrom }),
    ...(filtres.dateTo === '' ? {} : { dateTo: filtres.dateTo }),
  };
}

export async function fetchInscriptions(
  projet: ProjetApi,
  filtres: FiltresInscriptions,
): Promise<{ items: Inscription[]; meta: components['schemas']['PageAdmin'] }> {
  const search = filtres.search.trim();
  const sortie = unwrap(
    await apiClient.GET('/api/v1/enrolement/{projet}/inscriptions', {
      params: {
        path: { projet },
        query: {
          page: filtres.page,
          pageSize: filtres.pageSize,
          ...periode(filtres),
          ...(search === '' ? {} : { search }),
          ...(filtres.statut === null ? {} : { statut: filtres.statut }),
          ...(filtres.rapproche === null
            ? {}
            : { rapproche: filtres.rapproche ? ('true' as const) : ('false' as const) }),
          ...(filtres.inclureDisparues ? { inclureDisparues: 'true' as const } : {}),
        },
      },
    }),
  );
  return { items: sortie.items ?? [], meta: sortie.meta };
}

export async function fetchIndicateursEnrolement(
  projet: ProjetApi,
  filtres: FiltresInscriptions,
): Promise<IndicateursEnrolement> {
  return unwrap(
    await apiClient.GET('/api/v1/enrolement/{projet}/indicateurs', {
      params: { path: { projet }, query: periode(filtres) },
    }),
  );
}

export async function fetchReglagesEnrolement(projet: ProjetApi): Promise<ReglagesEnrolement> {
  return unwrap(
    await apiClient.GET('/api/v1/enrolement/{projet}/reglages', { params: { path: { projet } } }),
  );
}

export async function ecrireReglagesEnrolement(
  projet: ProjetApi,
  body: components['schemas']['EcrireReglagesInputBody'],
): Promise<ReglagesEnrolement> {
  return unwrap(
    await apiClient.PUT('/api/v1/enrolement/{projet}/reglages', {
      params: { path: { projet } },
      body,
    }),
  );
}

export async function tirerPlateforme(projet: ProjetApi): Promise<Tirage> {
  return unwrap(
    await apiClient.POST('/api/v1/enrolement/{projet}/tirage', { params: { path: { projet } } }),
  );
}

export async function viderInscriptions(projet: ProjetApi): Promise<{ supprimees: number }> {
  return unwrap(
    await apiClient.DELETE('/api/v1/enrolement/{projet}/inscriptions', {
      params: { path: { projet } },
    }),
  );
}

export async function retirerInscription(
  projet: ProjetApi,
  id: string,
): Promise<{ supprimees: number }> {
  return unwrap(
    await apiClient.DELETE('/api/v1/enrolement/{projet}/inscriptions/{id}', {
      params: { path: { projet, id } },
    }),
  );
}
