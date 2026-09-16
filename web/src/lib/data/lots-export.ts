import type { ApiClient, components, operations } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';
import { format, getISOWeek, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

import { getApiClient } from '@/lib/api/browser';
import { flattenPage } from '@/lib/api/query-params';
import type { Paginated, Projet } from '@/lib/types';

type Schemas = components['schemas'];
export type LotExportSummary = Schemas['LotExportSummaryDto'];
export type LotExportDetail = Schemas['LotExportDetailDto'];
export type CreateLotExportInput = Schemas['CreateLotExportDto'];
export type LotExportPreview = Schemas['LotExportPreviewDto'];
export type CampagnePerformance = Pick<
  LotExportDetail,
  'name' | 'performance' | 'fichesAppelees' | 'itemCount' | 'callsSince'
>;
export type LotExportQuery = NonNullable<operations['listLotsExport']['parameters']['query']>;
export type LotExportFiche = Schemas['LotExportFicheDto'];
export type LotExportFicheEtat = Schemas['LotExportFicheEtat'];
export type UpdateLotExportInput = Schemas['UpdateLotExportDto'];
export type LotExportImport = Schemas['LotExportImportDto'];
export type LotExportFichesQuery = NonNullable<
  operations['listLotExportFiches']['parameters']['query']
>;

export const TELECONSEIL_CAMPAGNES_PATH = '/teleconseil/campagnes';

/** La semaine et le mois se tapent tels quels dans la recherche des campagnes. */
export function periodeCampagne(iso: string): string {
  const date = parseISO(iso);
  return `Semaine ${getISOWeek(date)}, ${format(date, 'MMMM yyyy', { locale: fr })}`;
}

export function campagnesPath(_projet?: Projet | null): string {
  return TELECONSEIL_CAMPAGNES_PATH;
}

export async function fetchLotsExport(
  query: LotExportQuery,
  client: ApiClient = getApiClient(),
): Promise<Paginated<LotExportSummary>> {
  return flattenPage(unwrap(await client.GET('/api/v1/lots-export', { params: { query } })));
}

export async function createLotExport(
  body: CreateLotExportInput,
  client: ApiClient = getApiClient(),
): Promise<LotExportSummary> {
  return unwrap(await client.POST('/api/v1/lots-export', { body }));
}

/** Les onglets importés qui ont créé des fiches : les sources d'une campagne « fiches importées ». */
export async function fetchLotExportImports(
  client: ApiClient = getApiClient(),
): Promise<LotExportImport[]> {
  return unwrap(await client.GET('/api/v1/lots-export/imports')).items;
}

/**
 * L'aperçu est un POST : en GET, l'analyseur de requête de Fastify est plat et
 * `prospects[projet]=CHUES` lui arrive comme une clé littérale, que la
 * validation rejette.
 */
export async function previewLotExport(
  body: CreateLotExportInput,
  client: ApiClient = getApiClient(),
): Promise<LotExportPreview> {
  return unwrap(await client.POST('/api/v1/lots-export/apercu', { body }));
}

export async function fetchLotExport(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<LotExportDetail> {
  return unwrap(await client.GET('/api/v1/lots-export/{id}', { params: { path: { id } } }));
}

export async function updateLotExport(
  id: string,
  body: UpdateLotExportInput,
  client: ApiClient = getApiClient(),
): Promise<LotExportSummary> {
  return unwrap(await client.PATCH('/api/v1/lots-export/{id}', { params: { path: { id } }, body }));
}

export async function fetchLotExportFiches(
  id: string,
  query: LotExportFichesQuery,
  client: ApiClient = getApiClient(),
): Promise<Paginated<LotExportFiche>> {
  return flattenPage(
    unwrap(
      await client.GET('/api/v1/lots-export/{id}/fiches', { params: { path: { id }, query } }),
    ),
  );
}

/**
 * Toutes les fiches d'un état, page après page : une campagne de 3 000 fiches
 * ne se confie pas sur les 200 premières sans le dire.
 */
export async function fetchLotExportFichesToutes(
  id: string,
  etat: NonNullable<LotExportFichesQuery['etat']>,
  client: ApiClient = getApiClient(),
): Promise<LotExportFiche[]> {
  const taille = 200;
  const premiere = await fetchLotExportFiches(id, { etat, page: 1, pageSize: taille }, client);
  const suites = await Promise.all(
    Array.from({ length: Math.max(0, premiere.pageCount - 1) }, (_, index) =>
      fetchLotExportFiches(id, { etat, page: index + 2, pageSize: taille }, client),
    ),
  );
  return premiere.items.concat(...suites.map((page) => page.items));
}

export async function reaffecterFiches(
  id: string,
  body: { positions: number[]; versTeleconseillerId: string },
  client: ApiClient = getApiClient(),
): Promise<LotExportDetail> {
  return unwrap(
    await client.POST('/api/v1/lots-export/{id}/reaffectation', {
      params: { path: { id } },
      body,
    }),
  );
}

export async function retirerTeleconseiller(
  id: string,
  teleconseillerId: string,
  client: ApiClient = getApiClient(),
): Promise<LotExportDetail> {
  return unwrap(
    await client.POST('/api/v1/lots-export/{id}/retrait', {
      params: { path: { id } },
      body: { teleconseillerId },
    }),
  );
}

export async function ajouterTeleconseiller(
  id: string,
  body: { teleconseillerId: string; positions: number[] },
  client: ApiClient = getApiClient(),
): Promise<LotExportDetail> {
  return unwrap(
    await client.POST('/api/v1/lots-export/{id}/equipe', { params: { path: { id } }, body }),
  );
}

export async function deleteLotExport(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<void> {
  unwrap(await client.DELETE('/api/v1/lots-export/{id}', { params: { path: { id } } }));
}

/** La campagne choisie au filtre, ou la dernière lancée tant qu'aucune n'est choisie. */
export async function fetchCampagneRegardee(
  lotId: string | null,
  projet: Schemas['Projet'] | null,
  teleconseillerId: string | null,
  client: ApiClient = getApiClient(),
): Promise<CampagnePerformance | null> {
  let id = lotId;
  if (id === null) {
    const liste = await fetchLotsExport(
      { page: 1, pageSize: 1, ...(projet === null ? {} : { projet }) },
      client,
    );
    id = liste.items[0]?.id ?? null;
  }
  if (id === null) return null;

  const campagne = await fetchLotExport(id, client);
  return {
    name: campagne.name,
    itemCount: campagne.itemCount,
    fichesAppelees: campagne.fichesAppelees,
    callsSince: campagne.callsSince,
    performance:
      teleconseillerId === null
        ? campagne.performance
        : campagne.performance.filter((ligne) => ligne.teleconseillerId === teleconseillerId),
  };
}

export function lotExportUrl(id: string, format: 'xlsx' | 'zip'): string {
  return `/api/v1/lots-export/${encodeURIComponent(id)}/${format === 'xlsx' ? 'export.xlsx' : 'programmes.zip'}`;
}

export function lotProgrammeUrl(id: string, teleconseillerId: string, jour: number): string {
  const query = new URLSearchParams({ teleconseillerId, jour: String(jour) });
  return `/api/v1/lots-export/${encodeURIComponent(id)}/programme.pdf?${query.toString()}`;
}

export function lotFichesRecuesUrl(
  id: string,
  teleconseillerId: string,
  reaffectationId?: string,
): string {
  const query = new URLSearchParams({
    teleconseillerId,
    ...(reaffectationId === undefined ? {} : { reaffectationId }),
  });
  return `/api/v1/lots-export/${encodeURIComponent(id)}/fiches-recues.pdf?${query.toString()}`;
}

export function lotFichesRecuesFileName(teleconseillerName: string): string {
  const base = slug(teleconseillerName);
  return `fiches-recues-${base === '' ? 'teleconseiller' : base}.pdf`;
}

function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-zA-Z0-9]+/gu, '-')
    .replace(/^-|-$/gu, '')
    .toLowerCase();
}

export function lotExportFileName(name: string, format: 'xlsx' | 'zip'): string {
  const base = slug(name);
  return `campagne-${base === '' ? 'export' : base}.${format === 'xlsx' ? 'xlsx' : 'zip'}`;
}

export function lotProgrammeFileName(teleconseillerName: string, jour: number): string {
  const base = slug(teleconseillerName);
  return `programme-${base === '' ? 'teleconseiller' : base}-jour-${String(jour)}.pdf`;
}

export interface Teleconseiller {
  id: string;
  fullName: string;
  role: 'COMMERCIAL' | 'SUPERVISEUR' | 'DIRECTION';
}

export async function fetchTeleconseillers(
  client: ApiClient = getApiClient(),
): Promise<Teleconseiller[]> {
  const pages = await Promise.all(
    (['COMMERCIAL', 'SUPERVISEUR', 'DIRECTION'] as const).map((role) =>
      client.GET('/api/v1/users', { params: { query: { role, isActive: true, pageSize: 50 } } }),
    ),
  );

  return pages
    .flatMap((page) => unwrap(page).items)
    .map((user) => ({
      id: user.id,
      fullName: user.fullName,
      role: user.role as Teleconseiller['role'],
    }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'fr'));
}
