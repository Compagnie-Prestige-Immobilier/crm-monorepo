import type { ApiClient, components, operations } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { flattenPage } from '@/lib/api/query-params';
import type { Paginated, Projet } from '@/lib/types';

type Schemas = components['schemas'];
export type LotExportSummary = Schemas['LotExportSummaryDto'];
export type LotExportDetail = Schemas['LotExportDetailDto'];
export type CreateLotExportInput = Schemas['CreateLotExportDto'];
export type LotExportPreview = Schemas['LotExportPreviewDto'];
export type CampagnePerformance = Pick<LotExportDetail, 'name' | 'performance'>;
export type LotExportQuery = NonNullable<operations['listLotsExport']['parameters']['query']>;
export type LotExportFiche = Schemas['LotExportFicheDto'];
export type LotExportFicheEtat = Schemas['LotExportFicheEtat'];
export type UpdateLotExportInput = Schemas['UpdateLotExportDto'];
export type LotExportFichesQuery = NonNullable<
  operations['listLotExportFiches']['parameters']['query']
>;

/** Une campagne reste dans la coque de son projet ; un lot de représentants porte `CHUES`. */
export function campagnesPath(projet: Projet): string {
  return projet === 'GRAND_PUBLIC' ? '/grand-public/campagnes' : '/chues/campagnes';
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

export async function deleteLotExport(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<void> {
  unwrap(await client.DELETE('/api/v1/lots-export/{id}', { params: { path: { id } } }));
}

export async function fetchDerniereCampagne(
  projet: Schemas['Projet'],
  teleconseillerId: string | null,
  client: ApiClient = getApiClient(),
): Promise<CampagnePerformance | null> {
  const liste = await fetchLotsExport({ projet, page: 1, pageSize: 1 }, client);
  const resume = liste.items[0];
  if (resume === undefined) return null;

  const campagne = await fetchLotExport(resume.id, client);
  return {
    name: campagne.name,
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
