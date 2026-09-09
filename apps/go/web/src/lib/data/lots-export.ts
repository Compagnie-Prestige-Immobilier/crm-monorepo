import { apiClient, unwrap } from '@/api/client';
import type { components, operations } from '@/api/schema';
import type { ProjetApi } from '@/lib/types';

type Schemas = components['schemas'];

export type CampagneResume = Schemas['CampagneResume'];
export type CampagneDetail = Schemas['CampagneDetail'];
export type CampagneCreation = Schemas['CampagneCreationBody'];
export type CampagneApercu = Schemas['CampagneApercuOutputBody'];
export type CampagneFiche = Schemas['CampagneFiche'];
export type CampagneCible = CampagneResume['cible'];
export type CampagneFicheEtat = CampagneFiche['etat'];
export type CampagnePerformance = CampagneDetail['performance'];
export type CampagneReaffectation = NonNullable<CampagneDetail['reaffectations']>[number];
export type CampagnesQuery = NonNullable<operations['listLotsExport']['parameters']['query']>;
export type CampagneFichesQuery = NonNullable<
  operations['listLotExportFiches']['parameters']['query']
>;

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  pageCount: number;
}

function aplatir<T>(reponse: { items: T[] | null; meta: Schemas['CampagnePageMeta'] }): Page<T> {
  return {
    items: reponse.items ?? [],
    total: reponse.meta.total,
    page: reponse.meta.page,
    pageCount: reponse.meta.pageCount,
  };
}

export async function fetchCampagnes(query: CampagnesQuery): Promise<Page<CampagneResume>> {
  return aplatir(unwrap(await apiClient.GET('/api/v1/lots-export', { params: { query } })));
}

export async function fetchCampagne(id: string): Promise<CampagneDetail> {
  return unwrap(await apiClient.GET('/api/v1/lots-export/{id}', { params: { path: { id } } }));
}

export async function creerCampagne(body: CampagneCreation): Promise<CampagneResume> {
  return unwrap(await apiClient.POST('/api/v1/lots-export', { body }));
}

/**
 * L'aperçu est un POST : les critères sont un objet imbriqué, qu'une chaîne de
 * requête plate ne sait pas porter.
 */
export async function apercuCampagne(body: CampagneCreation): Promise<CampagneApercu> {
  return unwrap(await apiClient.POST('/api/v1/lots-export/apercu', { body }));
}

export async function modifierCampagne(
  id: string,
  body: Schemas['CampagneMajInputBody'],
): Promise<CampagneResume> {
  return unwrap(
    await apiClient.PATCH('/api/v1/lots-export/{id}', { params: { path: { id } }, body }),
  );
}

export async function supprimerCampagne(id: string): Promise<void> {
  unwrap(await apiClient.DELETE('/api/v1/lots-export/{id}', { params: { path: { id } } }));
}

export async function fetchCampagneFiches(
  id: string,
  query: CampagneFichesQuery,
): Promise<Page<CampagneFiche>> {
  return aplatir(
    unwrap(
      await apiClient.GET('/api/v1/lots-export/{id}/fiches', { params: { path: { id }, query } }),
    ),
  );
}

export async function reaffecterFiches(
  id: string,
  body: { positions: number[]; versTeleconseillerId: string },
): Promise<CampagneDetail> {
  return unwrap(
    await apiClient.POST('/api/v1/lots-export/{id}/reaffectation', {
      params: { path: { id } },
      body,
    }),
  );
}

export async function retirerTeleconseiller(
  id: string,
  teleconseillerId: string,
): Promise<CampagneDetail> {
  return unwrap(
    await apiClient.POST('/api/v1/lots-export/{id}/retrait', {
      params: { path: { id } },
      body: { teleconseillerId },
    }),
  );
}

/** La couverture de la dernière campagne, telle que le tableau de bord la lit. */
export async function fetchDerniereCampagne(
  projet: ProjetApi,
  teleconseillerId: string | null,
): Promise<{ name: string; performance: CampagnePerformance } | null> {
  const liste = await fetchCampagnes({ projet, page: 1, pageSize: 1 });
  const resume = liste.items[0];
  if (resume === undefined) return null;

  const campagne = await fetchCampagne(resume.id);
  const performance = campagne.performance ?? [];
  return {
    name: campagne.name,
    performance:
      teleconseillerId === null
        ? performance
        : performance.filter((ligne) => ligne.teleconseillerId === teleconseillerId),
  };
}

const cheminLot = (id: string): string => `/api/v1/lots-export/${encodeURIComponent(id)}`;

export function urlClasseurCampagne(id: string): string {
  return `${cheminLot(id)}/export.xlsx`;
}

export function urlProgrammesCampagne(id: string): string {
  return `${cheminLot(id)}/programmes.zip`;
}

export function urlProgramme(id: string, teleconseillerId: string, jour: number): string {
  const query = new URLSearchParams({ teleconseillerId, jour: String(jour) });
  return `${cheminLot(id)}/programme.pdf?${query.toString()}`;
}

export function urlFichesRecues(
  id: string,
  teleconseillerId: string,
  reaffectationId?: string,
): string {
  const query = new URLSearchParams({
    teleconseillerId,
    ...(reaffectationId === undefined ? {} : { reaffectationId }),
  });
  return `${cheminLot(id)}/fiches-recues.pdf?${query.toString()}`;
}
