import { serializeBankFilters, type BankCaseFilters } from '@/lib/bank-filters';
import { serializeGrandPublicFilters, type GrandPublicFilters } from '@/lib/data/grand-public';
import { serializeProspectFilters } from '@/lib/filters';
import type { ProspectFilters } from '@/lib/types';

// Les routes du serveur Go, versionnees et nommees par leur extension. Les
// chemins `/api/export/*` etaient ceux du relais Next de la v1 : le binaire
// repond « Route inconnue. » a tout `/api/` qu'il ne sert pas.
const CHEMIN_PROSPECTS = '/api/v1/export/prospects.xlsx';
const CHEMIN_DOSSIERS = '/api/v1/export/bank-cases.xlsx';

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

  // L'ecran ecrit « oui » et « non » dans son URL ; la route d'export attend le
  // booleen que porte le contrat.
  const revue = params.get('revue');
  if (revue !== null) params.set('revue', String(revue === 'oui'));

  const query = params.toString();
  return query === '' ? CHEMIN_PROSPECTS : `${CHEMIN_PROSPECTS}?${query}`;
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
export function buildGrandPublicExportUrl(filters: GrandPublicFilters, viewerId: string): string {
  const params = serializeGrandPublicFilters(filters);
  params.delete('page');
  params.delete('pageSize');
  // La route d'export ne connaît pas l'attribution de campagne. « Ajoutés par
  // moi » se retraduit en auteur de la saisie ; l'écran retire le bouton dans
  // l'autre cas plutôt que de livrer un classeur plus large que la liste.
  params.delete('origine');
  if (filters.origine === 'MOI') params.set('commercialId', viewerId);
  params.set('projet', 'GRAND_PUBLIC');
  return `${CHEMIN_PROSPECTS}?${params.toString()}`;
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
  return query === '' ? CHEMIN_DOSSIERS : `${CHEMIN_DOSSIERS}?${query}`;
}

export function bankExportFileName(now = new Date()): string {
  return `cpi-dossiers-bancaires-${now.toISOString().slice(0, 10)}.xlsx`;
}
