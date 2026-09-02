import { serializeBankFilters, type BankCaseFilters } from '@/lib/bank-filters';
import { serializeGrandPublicFilters, type GrandPublicFilters } from '@/lib/data/grand-public';
import { serializeProspectFilters } from '@/lib/filters';
import type { ProspectFilters } from '@/lib/types';

export type ProspectExportMode = 'filtered' | 'consolidated';

export function buildExportUrl(
  filters: ProspectFilters,
  mode: ProspectExportMode = 'filtered',
): string {
  const params = serializeProspectFilters(filters);
  params.delete('page');
  params.delete('pageSize');
  params.delete('sortBy');
  params.delete('sortDir');

  if (mode === 'consolidated') {
    params.delete('segment');
    params.set('mode', 'consolidated');
  }

  const query = params.toString();
  return query === '' ? '/api/export/prospects' : `/api/export/prospects?${query}`;
}

export function exportFileName(now = new Date(), mode: ProspectExportMode = 'filtered'): string {
  const stamp = now.toISOString().slice(0, 10);
  return mode === 'consolidated'
    ? `cpi-prospects-consolide-${stamp}.xlsx`
    : `cpi-prospects-${stamp}.xlsx`;
}

/**
 * La même route, avec les critères propres au Grand Public. Le classeur
 * consolidé n'a pas d'équivalent ici : il segmente en BDD1-BDD4, ce qui est
 * une notion CHUES.
 */
export function buildGrandPublicExportUrl(filters: GrandPublicFilters): string {
  const params = serializeGrandPublicFilters(filters);
  params.delete('page');
  params.delete('pageSize');
  params.set('projet', 'GRAND_PUBLIC');
  return `/api/export/prospects?${params.toString()}`;
}

export function grandPublicExportFileName(now = new Date()): string {
  return `cpi-prospects-grand-public-${now.toISOString().slice(0, 10)}.xlsx`;
}

export function buildBankExportUrl(filters: BankCaseFilters): string {
  const params = serializeBankFilters(filters);
  params.delete('page');
  params.delete('pageSize');
  params.delete('sortBy');
  params.delete('sortDir');
  // `serializeBankFilters` laisse le projet hors de l'URL des écrans ; la route
  // d'export, elle, n'a que ce paramètre pour savoir de quelle coque elle vient.
  if (filters.projet !== null) params.set('projet', filters.projet);
  const query = params.toString();
  return query === '' ? '/api/export/bank-cases' : `/api/export/bank-cases?${query}`;
}

export function bankExportFileName(now = new Date()): string {
  return `cpi-dossiers-bancaires-${now.toISOString().slice(0, 10)}.xlsx`;
}
