import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import type { Projet } from '@/lib/types';

type Schemas = components['schemas'];

export type { Projet };
export type InscriptionsPage = Schemas['ListerInscriptionsOutputBody'];
export type EnrolementReglages = Schemas['ReglagesOutputBody'];
export type EnrolementIndicateurs = Schemas['IndicateursOutputBody'];
export type Tirage = Schemas['TirageOutputBody'];
export type Suppression = Schemas['SuppressionInscriptionsOutputBody'];
export type InscriptionDetail = Schemas['InscriptionOutputBody'];

/** L'onglet de l'écran, et le projet qu'il tire. Les deux ne se mélangent jamais. */
export const ONGLETS_ENROLEMENT = ['chues', 'grand-public'] as const;
export type OngletEnrolement = (typeof ONGLETS_ENROLEMENT)[number];

export const projetDeLOnglet = (onglet: OngletEnrolement): Projet =>
  onglet === 'chues' ? 'CHUES' : 'GRAND_PUBLIC';

/** Les étages de l'entonnoir, tels que l'API les accepte. */
export type Avancement = 'ouvert' | 'soumis' | 'decide';

export interface FiltresInscriptions {
  page?: number | undefined;
  pageSize?: number | undefined;
  statut?: string | undefined;
  search?: string | undefined;
  dateFrom?: string | undefined;
  dateTo?: string | undefined;
  rapproche?: boolean | undefined;
  inclureDisparues?: boolean | undefined;
  avancement?: Avancement | undefined;
}

const query = (filtres: FiltresInscriptions): Record<string, string | number | boolean> =>
  Object.fromEntries(
    Object.entries(filtres).flatMap(([cle, valeur]) =>
      valeur === undefined || valeur === '' ? [] : [[cle, valeur]],
    ),
  );

export async function fetchInscriptions(
  projet: Projet,
  filtres: FiltresInscriptions,
  client: ApiClient = getApiClient(),
): Promise<InscriptionsPage> {
  return unwrap(
    await client.GET('/api/v1/enrolement/{projet}/inscriptions', {
      params: { path: { projet }, query: query(filtres) },
    }),
  );
}

/** Le détail porte la charge utile brute : le seul endroit où les champs que la plateforme envoie sans les décrire deviennent lisibles. */
export async function fetchInscriptionDetail(
  projet: Projet,
  id: string,
  client: ApiClient = getApiClient(),
): Promise<InscriptionDetail> {
  return unwrap(
    await client.GET('/api/v1/enrolement/{projet}/inscriptions/{id}', {
      params: { path: { projet, id } },
    }),
  );
}

export async function fetchIndicateursEnrolement(
  projet: Projet,
  filtres: Pick<FiltresInscriptions, 'dateFrom' | 'dateTo'>,
  client: ApiClient = getApiClient(),
): Promise<EnrolementIndicateurs> {
  return unwrap(
    await client.GET('/api/v1/enrolement/{projet}/indicateurs', {
      params: { path: { projet }, query: query(filtres) },
    }),
  );
}

export async function fetchReglagesEnrolement(
  projet: Projet,
  client: ApiClient = getApiClient(),
): Promise<EnrolementReglages> {
  return unwrap(
    await client.GET('/api/v1/enrolement/{projet}/reglages', { params: { path: { projet } } }),
  );
}

export async function saveReglagesEnrolement(
  projet: Projet,
  body: Schemas['EcrireReglagesInputBody'],
  client: ApiClient = getApiClient(),
): Promise<EnrolementReglages> {
  return unwrap(
    await client.PUT('/api/v1/enrolement/{projet}/reglages', {
      params: { path: { projet } },
      body,
    }),
  );
}

export async function purgerInscriptions(
  projet: Projet,
  client: ApiClient = getApiClient(),
): Promise<Suppression> {
  return unwrap(
    await client.DELETE('/api/v1/enrolement/{projet}/inscriptions', {
      params: { path: { projet } },
    }),
  );
}

export async function supprimerInscription(
  projet: Projet,
  id: string,
  client: ApiClient = getApiClient(),
): Promise<Suppression> {
  return unwrap(
    await client.DELETE('/api/v1/enrolement/{projet}/inscriptions/{id}', {
      params: { path: { projet, id } },
    }),
  );
}

export async function tirerPlateforme(
  projet: Projet,
  client: ApiClient = getApiClient(),
): Promise<Tirage> {
  return unwrap(
    await client.POST('/api/v1/enrolement/{projet}/tirage', { params: { path: { projet } } }),
  );
}
