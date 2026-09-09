import { apiClient, unwrap } from '@/api/client';
import type { components } from '@/api/schema';
import { fetchDerniereCampagne, type CampagnePerformance } from '@/lib/data/lots-export';
import {
  fetchActivite,
  fetchComptageOuvertures,
  type Activite,
  type ComptageJour,
} from '@/lib/data/supervision';
import { fetchCreneaux } from '@/lib/data/work-shifts';
import type { Creneau } from '@/lib/data/work-shifts';
import type { ProjetApi } from '@/lib/types';

type Schemas = components['schemas'];

export type ChiffresActivite = Activite;
export type ChiffresEntonnoir = Schemas['EntonnoirDesConversions'];
export type ChiffresDelais = Schemas['DelaisDeLaChaine'];
export type ChiffresRendement = Schemas['RendementParDepartement'];
export type ChiffresMethodes = Schemas['RepartitionParMethodeEnrolement'];
export type ChiffresBanques = Schemas['RepartitionDesProspects'];
export type ChiffresCampagnes = Schemas['RendementDesCampagnes'];
export type ChiffresRepresentants = Schemas['StockDesRepresentants'];
export type ChiffresEnrolement = Schemas['IndicateursOutputBody'];
export type ChiffresOuvertures = ComptageJour[];
export type ChiffresCampagne = { name: string; performance: CampagnePerformance } | null;

/** L'activité relue créneau par créneau, dans l'ordre des créneaux. */
export interface ChiffresCreneaux {
  creneaux: Creneau[];
  activites: ChiffresActivite[];
}

/** Le périmètre commun à toutes les requêtes de l'écran. */
export interface Perimetre {
  projet: ProjetApi;
  plage: { from: string; to: string };
  /** Un seul téléconseiller, ou tous. */
  commercialId: string | null;
}

/**
 * Les filtres de prospect partagés par les analyses. `dateFrom`/`dateTo` bornent
 * la date de SAISIE de la fiche, là où `/supervision/activite` borne la date de
 * l'acte : les deux familles de chiffres ne se recoupent pas au jour près.
 */
const filtresProspect = (
  perimetre: Perimetre,
): { projet: ProjetApi; dateFrom: string; dateTo: string; commercialId?: string } => ({
  projet: perimetre.projet,
  dateFrom: perimetre.plage.from,
  dateTo: perimetre.plage.to,
  ...(perimetre.commercialId === null ? {} : { commercialId: perimetre.commercialId }),
});

const filtresActe = (
  perimetre: Perimetre,
): { actFrom: string; actTo: string; projet: ProjetApi; commercialId?: string } => ({
  actFrom: `${perimetre.plage.from}T00:00:00.000Z`,
  actTo: `${perimetre.plage.to}T23:59:59.999Z`,
  projet: perimetre.projet,
  ...(perimetre.commercialId === null ? {} : { commercialId: perimetre.commercialId }),
});

export async function fetchChiffresActivite(perimetre: Perimetre): Promise<ChiffresActivite> {
  return unwrap(
    await apiClient.GET('/api/v1/supervision/activite', {
      params: { query: { ...filtresActe(perimetre), granularity: 'day' } },
    }),
  );
}

export async function fetchChiffresCreneaux(perimetre: Perimetre): Promise<ChiffresCreneaux> {
  const creneaux = (await fetchCreneaux()).shifts ?? [];
  const activites = await Promise.all(
    creneaux.map((creneau) =>
      fetchActivite({
        periode: perimetre.plage,
        granularite: 'day',
        projet: perimetre.projet,
        creneau: { start: creneau.start, end: creneau.end },
      }),
    ),
  );
  return { creneaux, activites };
}

export async function fetchChiffresCampagnes(perimetre: Perimetre): Promise<ChiffresCampagnes> {
  return unwrap(
    await apiClient.GET('/api/v1/supervision/campagnes', {
      params: { query: filtresActe(perimetre) },
    }),
  );
}

/** Le stock ne se borne ni à une période ni à un téléconseiller. */
export async function fetchChiffresRepresentants(): Promise<ChiffresRepresentants> {
  return unwrap(await apiClient.GET('/api/v1/supervision/representants'));
}

export async function fetchChiffresEntonnoir(perimetre: Perimetre): Promise<ChiffresEntonnoir> {
  return unwrap(
    await apiClient.GET('/api/v1/analytics/funnel', {
      params: { query: filtresProspect(perimetre) },
    }),
  );
}

export async function fetchChiffresDelais(perimetre: Perimetre): Promise<ChiffresDelais> {
  return unwrap(
    await apiClient.GET('/api/v1/analytics/delays', {
      params: { query: filtresProspect(perimetre) },
    }),
  );
}

export async function fetchChiffresRendement(perimetre: Perimetre): Promise<ChiffresRendement> {
  return unwrap(
    await apiClient.GET('/api/v1/analytics/departement-yield', {
      params: { query: filtresProspect(perimetre) },
    }),
  );
}

export async function fetchChiffresMethodes(perimetre: Perimetre): Promise<ChiffresMethodes> {
  return unwrap(
    await apiClient.GET('/api/v1/analytics/by-enrollment-method', {
      params: { query: filtresProspect(perimetre) },
    }),
  );
}

export async function fetchChiffresBanques(perimetre: Perimetre): Promise<ChiffresBanques> {
  return unwrap(
    await apiClient.GET('/api/v1/analytics/by-banque', {
      params: { query: filtresProspect(perimetre) },
    }),
  );
}

export async function fetchChiffresCampagne(perimetre: Perimetre): Promise<ChiffresCampagne> {
  return fetchDerniereCampagne(perimetre.projet, perimetre.commercialId);
}

export async function fetchChiffresOuvertures(perimetre: Perimetre): Promise<ChiffresOuvertures> {
  return fetchComptageOuvertures(perimetre.plage);
}

/**
 * Réservé à l'ADMIN : le catalogue ne propose ces cartes qu'à lui, et l'API
 * refuse tout autre rôle. Le téléconseiller regardé ne borne pas ces chiffres,
 * qui sont ceux de la plateforme et non ceux d'un portefeuille.
 */
export async function fetchChiffresEnrolement(perimetre: Perimetre): Promise<ChiffresEnrolement> {
  return unwrap(
    await apiClient.GET('/api/v1/enrolement/{projet}/indicateurs', {
      params: {
        path: { projet: perimetre.projet },
        query: { dateFrom: perimetre.plage.from, dateTo: perimetre.plage.to },
      },
    }),
  );
}
