import { serializeBankFilters, type BankCaseFilters } from '@/lib/bank-filters';
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

export function buildBankExportUrl(filters: BankCaseFilters): string {
  const params = serializeBankFilters(filters);
  params.delete('page');
  params.delete('pageSize');
  params.delete('sortBy');
  params.delete('sortDir');
  const query = params.toString();
  return query === '' ? '/api/export/bank-cases' : `/api/export/bank-cases?${query}`;
}

export function bankExportFileName(now = new Date()): string {
  return `cpi-dossiers-bancaires-${now.toISOString().slice(0, 10)}.xlsx`;
}
