import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { fetchWorkShifts, type ActivityRange, type WorkShifts } from '@/lib/data/admin';
import {
  fetchCampagneRegardee,
  fetchLotsExport,
  type CampagnePerformance,
  type LotExportSummary,
} from '@/lib/data/lots-export';

type Schemas = components['schemas'];

export type Projet = Schemas['Projet'];
export type ChiffresActivite = Schemas['SupervisionActivityDto'];
export type ChiffresTotaux = Schemas['SupervisionActivityCountsDto'];
export type ChiffresEntonnoir = Schemas['AnalyticsFunnelDto'];
export type ChiffresDelais = Schemas['AnalyticsDelaysDto'];
export type ChiffresRendement = Schemas['DepartementYieldListDto'];
export type ChiffresMethodes = Schemas['EnrollmentMethodListDto'];
export type ChiffresBanques = Schemas['NamedCountListDto'];
export type ChiffresCampagne = CampagnePerformance | null;

/** Les compteurs d'une campagne depuis sa création, hors fenêtre regardée. */
export type CouvertureCampagne = Pick<
  LotExportSummary,
  'itemCount' | 'fichesAppelees' | 'callsSince'
>;

/** Le rendement de la fenêtre, et pour chaque campagne sa couverture depuis la création. */
export type ChiffresCampagnes = Omit<Schemas['SupervisionCampagnesDto'], 'items'> & {
  items: (Schemas['SupervisionCampagneDto'] & { couverture?: CouvertureCampagne })[];
};
export type ChiffresRepresentants = Schemas['StockRepresentantsDto'];
export type QualiteDeLaBase = Schemas['QualiteDeLaBase'];
export type QualiteDuMarketing = Schemas['QualiteDuMarketing'];
export type ChiffresEnrolement = Schemas['EnrolementIndicateursDto'];

/** L'activité relue créneau par créneau, dans l'ordre des créneaux. */
export interface ChiffresCreneaux {
  creneaux: WorkShifts['shifts'];
  activites: ChiffresActivite[];
}

/** Le périmètre commun à toutes les requêtes de l'écran. */
export interface PerimetreChiffres {
  projet: Projet | null;
  plage: ActivityRange;
  /** Un seul téléconseiller, ou tous. */
  commercialId: string | null;
  /** Une seule campagne d'appels prospects, ou toutes. */
  lotId: string | null;
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
): { projet?: Projet; dateFrom: string; dateTo: string; commercialId?: string } => ({
  ...(perimetre.projet === null ? {} : { projet: perimetre.projet }),
  dateFrom: perimetre.plage.from,
  dateTo: perimetre.plage.to,
  ...(perimetre.commercialId === null ? {} : { commercialId: perimetre.commercialId }),
});

const filtresSupervision = (
  perimetre: PerimetreChiffres,
): { actFrom: string; actTo: string; projet?: Projet; commercialId?: string; lotId?: string } => ({
  ...bornes(perimetre.plage),
  ...(perimetre.projet === null ? {} : { projet: perimetre.projet }),
  ...(perimetre.commercialId === null ? {} : { commercialId: perimetre.commercialId }),
  ...(perimetre.lotId === null ? {} : { lotId: perimetre.lotId }),
});

export async function fetchChiffresActivite(
  perimetre: PerimetreChiffres,
  client: ApiClient = getApiClient(),
  creneau?: { start: string; end: string },
): Promise<ChiffresActivite> {
  return unwrap(
    await client.GET('/api/v1/supervision/activite', {
      params: {
        query: {
          ...filtresSupervision(perimetre),
          granularity: 'day',
          ...(creneau === undefined ? {} : { timeFrom: creneau.start, timeTo: creneau.end }),
        },
      },
    }),
  );
}

export async function fetchChiffresCreneaux(
  perimetre: PerimetreChiffres,
  client: ApiClient = getApiClient(),
): Promise<ChiffresCreneaux> {
  const creneaux = (await fetchWorkShifts(client)).shifts;
  const activites = await Promise.all(
    creneaux.map((creneau) => fetchChiffresActivite(perimetre, client, creneau)),
  );
  return { creneaux, activites };
}

/**
 * La couverture « depuis la création » ne se lit pas dans le rendement, qui est
 * borné à la fenêtre : elle vient de la liste des campagnes, comme sur le détail
 * d'une campagne.
 */
export async function fetchChiffresCampagnes(
  perimetre: PerimetreChiffres,
  client: ApiClient = getApiClient(),
): Promise<ChiffresCampagnes> {
  const rendement = unwrap(
    await client.GET('/api/v1/supervision/campagnes', {
      params: { query: filtresSupervision(perimetre) },
    }),
  );
  const liste = await fetchLotsExport(
    { page: 1, pageSize: 50, ...(perimetre.projet === null ? {} : { projet: perimetre.projet }) },
    client,
  );
  const couvertures = new Map(liste.items.map((lot) => [lot.id, lot]));
  return {
    ...rendement,
    items: rendement.items.map((campagne) => {
      const lot = couvertures.get(campagne.id);
      if (lot === undefined) return campagne;
      const { itemCount, fichesAppelees, callsSince } = lot;
      return { ...campagne, couverture: { itemCount, fichesAppelees, callsSince } };
    }),
  };
}

/** Le stock ne se borne ni à une période ni à un téléconseiller. */
export async function fetchChiffresRepresentants(
  _perimetre: PerimetreChiffres,
  client: ApiClient = getApiClient(),
): Promise<ChiffresRepresentants> {
  return unwrap(await client.GET('/api/v1/supervision/representants'));
}

/** La qualité de la base représentants ne se borne ni à une période ni à un projet. */
export async function fetchQualiteDeLaBase(
  client: ApiClient = getApiClient(),
): Promise<QualiteDeLaBase> {
  return unwrap(await client.GET('/api/v1/supervision/representants/qualite'));
}

/** La performance du marketing se lit sur toute la base, les deux projets confondus. */
export async function fetchQualiteDuMarketing(
  client: ApiClient = getApiClient(),
): Promise<QualiteDuMarketing> {
  return unwrap(await client.GET('/api/v1/supervision/prospects/marketing'));
}

export async function fetchChiffresObjectifs(client: ApiClient = getApiClient()) {
  return unwrap(await client.GET('/api/v1/supervision/objectifs'));
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

export async function fetchChiffresCampagne(
  perimetre: PerimetreChiffres,
): Promise<ChiffresCampagne> {
  return fetchCampagneRegardee(perimetre.lotId, perimetre.projet, perimetre.commercialId);
}

/**
 * Réservé à l'ADMIN : le catalogue ne propose ces cartes qu'à lui, et l'API
 * refuse tout autre rôle. Le téléconseiller regardé ne borne pas ces chiffres,
 * qui sont ceux de la plateforme et non ceux d'un portefeuille.
 */
export async function fetchChiffresEnrolement(
  perimetre: PerimetreChiffres,
  client: ApiClient = getApiClient(),
): Promise<ChiffresEnrolement> {
  return unwrap(
    await client.GET('/api/v1/enrolement/{projet}/indicateurs', {
      params: {
        path: { projet: perimetre.projet ?? 'CHUES' },
        query: { dateFrom: perimetre.plage.from, dateTo: perimetre.plage.to },
      },
    }),
  );
}
