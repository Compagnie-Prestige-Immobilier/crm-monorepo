import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';

type Schemas = components['schemas'];

export type ImportJob = Schemas['ImportJobDto'];
export type ImportJobReport = Schemas['ImportJobReportDto'];
export type ImportKind = Schemas['ImportKind'];

export interface ImportJobPage {
  items: ImportJob[];
  total: number;
  page: number;
  pageCount: number;
}

export const IMPORT_HISTORY_PAGE_SIZE = 10;

export const IMPORT_KIND_LABELS: Readonly<Record<ImportKind, string>> = {
  REPRESENTANTS: 'Représentants',
  PROSPECTS: 'Prospects',
};

/** Plafonds des adaptateurs d'import, annoncés avant le dépôt. */
export const IMPORT_MAX_ROWS: Readonly<Record<ImportKind, number>> = {
  REPRESENTANTS: 50_000,
  PROSPECTS: 150_000,
};

export const IMPORT_TEMPLATES: Readonly<Record<ImportKind, { url: string; fileName: string }>> = {
  REPRESENTANTS: {
    url: '/api/v1/export/representants-modele.xlsx',
    fileName: 'cpi-representants-modele.xlsx',
  },
  PROSPECTS: {
    url: '/api/v1/export/prospects-modele.xlsx',
    fileName: 'cpi-prospects-modele.xlsx',
  },
};

export async function fetchImportJobs(
  page: number,
  client: ApiClient = getApiClient(),
): Promise<ImportJobPage> {
  const result = unwrap(
    await client.GET('/api/v1/imports', {
      params: { query: { page, pageSize: IMPORT_HISTORY_PAGE_SIZE } },
    }),
  );
  return {
    items: result.items,
    total: result.meta.total,
    page: result.meta.page,
    pageCount: result.meta.pageCount,
  };
}

export async function fetchImportJob(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<ImportJob> {
  return unwrap(await client.GET('/api/v1/imports/{id}', { params: { path: { id } } }));
}

/** Remet le même travail en file, en mode APPLY. Écrit en base. */
export async function applyImportJob(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<ImportJob> {
  return unwrap(await client.POST('/api/v1/imports/{id}/apply', { params: { path: { id } } }));
}

const UPLOAD_PATHS: Readonly<Record<ImportKind, string>> = {
  REPRESENTANTS: '/api/v1/imports/representants',
  PROSPECTS: '/api/v1/imports/prospects',
};

/*
 * `POST /imports/prospects` n'est pas encore dans le client engendré : `pnpm codegen`
 * n'a pas été rejoué. On frappe le relais comme le ferait le client, l'erreur repassant
 * par `unwrap` pour que les refus du mode démonstration restent traduits.
 * À REMPLACER par `client.POST(...)` à la première régénération du contrat.
 */
export async function createImportJob(
  kind: ImportKind,
  file: File,
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): Promise<ImportJob> {
  const form = new FormData();
  form.append('file', file);

  // Aucun `content-type` posé ici : le navigateur écrit la frontière multipart.
  const response = await fetchImpl(UPLOAD_PATHS[kind], { method: 'POST', body: form });
  const text = await response.text();
  const body: unknown = text === '' ? undefined : JSON.parse(text);

  return unwrap<ImportJob, unknown>(
    response.ok ? { data: body as ImportJob, response } : { error: body ?? {}, response },
  );
}
