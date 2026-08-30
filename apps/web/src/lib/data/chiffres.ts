import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import type { ActivityRange } from '@/lib/data/admin';

type Schemas = components['schemas'];

export type Projet = Schemas['Projet'];
export type ChiffresActivite = Schemas['SupervisionActivityDto'];
export type ChiffresTotaux = Schemas['SupervisionActivityCountsDto'];
export type ChiffresLigne = Schemas['SupervisionActivityRowDto'];
export type ChiffresEntonnoir = Schemas['AnalyticsFunnelDto'];
export type ChiffresDelais = Schemas['AnalyticsDelaysDto'];
export type ChiffresRendement = Schemas['DepartementYieldListDto'];
export type ChiffresMethodes = Schemas['EnrollmentMethodListDto'];
export type ChiffresBanques = Schemas['NamedCountListDto'];

/** Le périmètre commun à toutes les requêtes de l'écran. */
export interface PerimetreChiffres {
  projet: Projet;
  plage: ActivityRange;
  /** Un seul téléconseiller, ou tous. */
  commercialId: string | null;
}

const bornes = (plage: ActivityRange): { actFrom: string; actTo: string } => ({
  actFrom: `${plage.from}T00:00:00.000Z`,
  actTo: `${plage.to}T23:59:59.999Z`,
});

/**
 * Les filtres de prospect partagés par les analyses. `dateFrom`/`dateTo` bornent
 * la date de SAISIE de la fiche, là où `/supervision/activite` borne la date de
 * l'acte : les deux familles de chiffres ne se recoupent pas au jour près.
 */
const filtresProspect = (
  perimetre: PerimetreChiffres,
): { projet: Projet; dateFrom: string; dateTo: string; commercialId?: string } => ({
  projet: perimetre.projet,
  dateFrom: perimetre.plage.from,
  dateTo: perimetre.plage.to,
  ...(perimetre.commercialId === null ? {} : { commercialId: perimetre.commercialId }),
});

export async function fetchChiffresActivite(
  perimetre: PerimetreChiffres,
  client: ApiClient = getApiClient(),
): Promise<ChiffresActivite> {
  return unwrap(
    await client.GET('/api/v1/supervision/activite', {
      params: {
        query: {
          ...bornes(perimetre.plage),
          granularity: 'day',
          projet: perimetre.projet,
          ...(perimetre.commercialId === null ? {} : { commercialId: perimetre.commercialId }),
        },
      },
    }),
  );
}

export async function fetchChiffresEntonnoir(
  perimetre: PerimetreChiffres,
  client: ApiClient = getApiClient(),
): Promise<ChiffresEntonnoir> {
  return unwrap(
    await client.GET('/api/v1/analytics/funnel', { params: { query: filtresProspect(perimetre) } }),
  );
}

export async function fetchChiffresDelais(
  perimetre: PerimetreChiffres,
  client: ApiClient = getApiClient(),
): Promise<ChiffresDelais> {
  return unwrap(
    await client.GET('/api/v1/analytics/delays', { params: { query: filtresProspect(perimetre) } }),
  );
}

export async function fetchChiffresRendement(
  perimetre: PerimetreChiffres,
  client: ApiClient = getApiClient(),
): Promise<ChiffresRendement> {
  return unwrap(
    await client.GET('/api/v1/analytics/departement-yield', {
      params: { query: filtresProspect(perimetre) },
    }),
  );
}

export async function fetchChiffresMethodes(
  perimetre: PerimetreChiffres,
  client: ApiClient = getApiClient(),
): Promise<ChiffresMethodes> {
  return unwrap(
    await client.GET('/api/v1/analytics/by-enrollment-method', {
      params: { query: filtresProspect(perimetre) },
    }),
  );
}

export async function fetchChiffresBanques(
  perimetre: PerimetreChiffres,
  client: ApiClient = getApiClient(),
): Promise<ChiffresBanques> {
  return unwrap(
    await client.GET('/api/v1/analytics/by-banque', {
      params: { query: filtresProspect(perimetre) },
    }),
  );
}
