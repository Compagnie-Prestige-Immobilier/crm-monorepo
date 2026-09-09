import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { flattenPage } from '@/lib/api/query-params';
import type { Paginated } from '@/lib/types';

type Schemas = components['schemas'];

export type VisitesImportJob = Schemas['ImportJobDto'];
export type VisitesImportChange = Schemas['VisiteImportChangeDto'];

/** Aligné sur `IMPORTS_MAX_BYTES` de l'API : refuser ici évite un 413. */
export const VISITES_IMPORT_MAX_BYTES = 25 * 1024 * 1024;

const VISITES_IMPORT_REVUE_PAGE_SIZE = 50;

export interface VisitesExportFilters {
  from: string | null;
  to: string | null;
  entrepriseId: string | null;
  directionId: string | null;
  destinataireId: string | null;
  objetId: string | null;
  search: string;
}

export function buildVisitesExportUrl(filters: VisitesExportFilters): string {
  const params = new URLSearchParams();
  const put = (key: string, value: string | null): void => {
    if (value !== null && value !== '') params.set(key, value);
  };

  put('from', filters.from);
  put('to', filters.to);
  put('entrepriseId', filters.entrepriseId);
  put('directionId', filters.directionId);
  put('destinataireId', filters.destinataireId);
  put('objetId', filters.objetId);
  put('search', filters.search.trim());

  const rendered = params.toString();
  return rendered === ''
    ? '/api/v1/export/visites.xlsx'
    : `/api/v1/export/visites.xlsx?${rendered}`;
}

export function visitesExportFileName(now = new Date()): string {
  return `cpi-registre-visites-${now.toISOString().slice(0, 10)}.xlsx`;
}

export async function createVisitesImportJob(
  file: File,
  client: ApiClient = getApiClient(),
): Promise<VisitesImportJob> {
  const form = new FormData();
  form.append('file', file);

  return unwrap(
    await client.POST('/api/v1/visites/import', {
      body: { file: '' },
      bodySerializer: () => form,
    }),
  );
}

export async function fetchVisitesImportJob(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<VisitesImportJob> {
  return unwrap(await client.GET('/api/v1/visites/import/{id}', { params: { path: { id } } }));
}

export async function fetchVisitesImportRevue(
  id: string,
  page: number,
  client: ApiClient = getApiClient(),
  pageSize: number = VISITES_IMPORT_REVUE_PAGE_SIZE,
): Promise<Paginated<VisitesImportChange>> {
  return flattenPage(
    unwrap(
      await client.GET('/api/v1/visites/import/{id}/revue', {
        params: { path: { id }, query: { page, pageSize } },
      }),
    ),
  );
}

export async function setVisitesImportSelection(
  id: string,
  ids: readonly string[],
  selected: boolean,
  client: ApiClient = getApiClient(),
): Promise<void> {
  unwrap(
    await client.PATCH('/api/v1/visites/import/{id}/revue', {
      params: { path: { id } },
      body: { ids: [...ids], selected },
    }),
  );
}

export async function applyVisitesImportJob(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<VisitesImportJob> {
  return unwrap(
    await client.POST('/api/v1/visites/import/{id}/apply', { params: { path: { id } } }),
  );
}
