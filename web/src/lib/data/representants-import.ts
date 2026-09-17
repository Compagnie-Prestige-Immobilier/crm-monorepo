import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';
import { toRepresentantQuery } from '@/lib/data/representants';
import { EMPTY_REPRESENTANT_FILTERS, type RepresentantFilters } from '@/lib/representant-filters';

type Schemas = components['schemas'];

export type ImportReport = Schemas['RapportRepresentantsOutputBody'];

export async function importRepresentants(
  file: File,
  dryRun: boolean,
  client: ApiClient = getApiClient(),
): Promise<ImportReport> {
  const form = new FormData();
  form.append('file', file);

  return unwrap(
    await client.POST('/api/v1/representants/import', {
      params: { query: { dryRun } },
      body: { file: '' },
      bodySerializer: () => form,
    }),
  );
}

export const REPRESENTANTS_TEMPLATE_URL = '/api/v1/export/representants-modele.xlsx';

export const REPRESENTANTS_TEMPLATE_FILE_NAME = 'cpi-representants-modele.xlsx';

export type RepresentantsExportMode = 'filtered' | 'all';

export function buildRepresentantsExportUrl(
  filters: RepresentantFilters,
  mode: RepresentantsExportMode = 'filtered',
): string {
  const query = toRepresentantQuery(mode === 'all' ? EMPTY_REPRESENTANT_FILTERS : filters);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === 'page' || key === 'pageSize' || key === 'sortBy' || key === 'sortOrder') continue;
    params.set(key, String(value));
  }
  const rendered = params.toString();
  return rendered === ''
    ? '/api/v1/export/representants.xlsx'
    : `/api/v1/export/representants.xlsx?${rendered}`;
}

export function representantsExportFileName(
  now = new Date(),
  mode: RepresentantsExportMode = 'filtered',
): string {
  const suffix = mode === 'all' ? '-tous' : '';
  return `cpi-representants${suffix}-${now.toISOString().slice(0, 10)}.xlsx`;
}
