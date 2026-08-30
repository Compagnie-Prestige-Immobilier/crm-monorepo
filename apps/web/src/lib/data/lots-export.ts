import type { ApiClient, components, operations } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { flattenPage } from '@/lib/api/query-params';
import type { Paginated } from '@/lib/types';

type Schemas = components['schemas'];
export type LotExportCible = Schemas['LotExportCible'];
export type LotExportSummary = Schemas['LotExportSummaryDto'];
export type LotExportDetail = Schemas['LotExportDetailDto'];
export type CreateLotExportInput = Schemas['CreateLotExportDto'];
export type LotExportPreview = Schemas['LotExportPreviewDto'];
export type LotExportQuery = NonNullable<operations['listLotsExport']['parameters']['query']>;

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
  return `lot-${base === '' ? 'export' : base}.${format === 'xlsx' ? 'xlsx' : 'zip'}`;
}

export function lotProgrammeFileName(teleconseillerName: string, jour: number): string {
  const base = slug(teleconseillerName);
  return `programme-${base === '' ? 'teleconseiller' : base}-jour-${String(jour)}.pdf`;
}

export interface Teleconseiller {
  id: string;
  fullName: string;
}

/**
 * Les deux rôles qui passent des appels. L'API filtre sur un rôle à la fois,
 * d'où les deux requêtes.
 */
export async function fetchTeleconseillers(
  client: ApiClient = getApiClient(),
): Promise<Teleconseiller[]> {
  const pages = await Promise.all(
    (['COMMERCIAL', 'SUPERVISEUR'] as const).map((role) =>
      client.GET('/api/v1/users', { params: { query: { role, isActive: true, pageSize: 50 } } }),
    ),
  );

  return pages
    .flatMap((page) => unwrap(page).items)
    .map((user) => ({ id: user.id, fullName: user.fullName }))
    .sort((a, b) => a.fullName.localeCompare(b.fullName, 'fr'));
}
