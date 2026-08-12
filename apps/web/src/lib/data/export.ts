import { serializeBankFilters, type BankCaseFilters } from '@/lib/bank-filters';
import { serializeProspectFilters } from '@/lib/filters';
import type { ProspectFilters } from '@/lib/types';

/**
 * L'export part des MÊMES filtres que l'écran. C'est la raison d'être de
 * `ProspectFilters` : l'administrateur qui envoie le fichier à sa direction
 * doit pouvoir jurer qu'il contient ce qu'il avait sous les yeux.
 *
 * Le navigateur ne peut pas appeler le backend directement : le JWT vit dans un
 * cookie httpOnly, donc hors de portée de JavaScript. La requête passe par le
 * Route Handler `/api/export/*`, qui rattache le jeton côté serveur.
 */

/**
 * Deux modes, deux significations.
 *
 * `filtered` décrit la population affichée. `consolidated` ignore
 * délibérément le critère de segment — c'est le CLASSEUR qui porte la
 * segmentation, en cinq feuilles fixes (Consolidé, BDD1…BDD4). Envoyer
 * `segment=BDD2` avec `mode=consolidated` produirait quatre feuilles vides sur
 * cinq ; on le retire donc plutôt que de laisser l'utilisateur découvrir le
 * résultat en ouvrant Excel.
 */
export type ProspectExportMode = 'filtered' | 'consolidated';

export function buildExportUrl(
  filters: ProspectFilters,
  mode: ProspectExportMode = 'filtered',
): string {
  const params = serializeProspectFilters(filters);
  // La pagination n'a aucun sens dans un export : le fichier contient tout ce
  // que le filtre sélectionne, pas la page affichée.
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

/** Nom de fichier daté, pour ne pas empiler dix `prospects.xlsx` dans Téléchargements. */
export function exportFileName(now = new Date(), mode: ProspectExportMode = 'filtered'): string {
  const stamp = now.toISOString().slice(0, 10);
  return mode === 'consolidated'
    ? `cpi-prospects-consolide-${stamp}.xlsx`
    : `cpi-prospects-${stamp}.xlsx`;
}

// ─── Banque & Finance ───────────────────────────────────────────────────────

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
