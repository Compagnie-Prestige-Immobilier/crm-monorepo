import type { operations } from '@crm/api-client';

import type { Paginated, ProspectFilters } from '@/lib/types';

/**
 * Traduction `ProspectFilters` → paramètres de requête de l'API.
 *
 * Le type de sortie est celui du contrat généré, pas un `Record<string,
 * string>` : ajouter un critère que l'API n'expose pas fait échouer le
 * `typecheck` au lieu de partir dans l'URL et d'être ignoré en silence.
 */
export type ProspectQuery = NonNullable<operations['listProspects']['parameters']['query']>;
export type AnalyticsQuery = NonNullable<operations['getAnalyticsTotals']['parameters']['query']>;

/**
 * Borne basse d'une journée locale, en instant ISO.
 *
 * `dateFrom=2026-08-12` seul serait interprété comme minuit pile : correct pour
 * la borne basse, mais la borne haute exclurait toute la journée. Vérifié sur
 * l'API : `dateTo=2026-08-12` renvoie zéro ligne pour un prospect saisi à 10 h
 * ce jour-là. Les deux bornes sont donc explicitées.
 *
 * L'heure métier est `Africa/Dakar`, c'est-à-dire UTC+0 toute l'année (pas de
 * changement d'heure au Sénégal) : `Z` est exact, sans conversion.
 */
function startOfDay(isoDate: string): string {
  return `${isoDate}T00:00:00.000Z`;
}

function endOfDay(isoDate: string): string {
  return `${isoDate}T23:59:59.999Z`;
}

/**
 * Partie commune au tableau, aux graphiques et à l'export : les critères de
 * sélection, sans pagination ni tri. C'est ce qui garantit qu'un fichier Excel
 * décrit exactement la population affichée.
 */
export function toFilterQuery(filters: ProspectFilters): AnalyticsQuery {
  const query: AnalyticsQuery = {};

  const search = filters.search.trim();
  if (search !== '') query.search = search;
  if (filters.commercialId !== null) query.commercialId = filters.commercialId;
  if (filters.representantId !== null) query.representantId = filters.representantId;
  if (filters.departementId !== null) query.departementId = filters.departementId;
  if (filters.banqueId !== null) query.banqueId = filters.banqueId;
  if (filters.syndicatId !== null) query.syndicatId = filters.syndicatId;
  if (filters.statut !== null) query.statut = filters.statut;
  if (filters.segment !== null) query.segment = filters.segment;
  if (filters.phase2Status !== null) query.phase2Status = filters.phase2Status;
  if (filters.enrollmentMethod !== null) query.enrollmentMethod = filters.enrollmentMethod;
  if (filters.campaignId !== null) query.campaignId = filters.campaignId;
  if (filters.enrollmentCapturedById !== null) {
    query.enrollmentCapturedById = filters.enrollmentCapturedById;
  }
  if (filters.dateFrom !== null) query.dateFrom = startOfDay(filters.dateFrom);
  if (filters.dateTo !== null) query.dateTo = endOfDay(filters.dateTo);

  return query;
}

/** Les mêmes critères, plus la pagination et le tri du tableau. */
export function toProspectQuery(filters: ProspectFilters): ProspectQuery {
  return {
    ...toFilterQuery(filters),
    page: filters.page,
    pageSize: filters.pageSize,
    sortBy: filters.sortBy,
    sortOrder: filters.sortDir,
  };
}

/** `{ items, meta }` du contrat → pagination aplatie du panel. */
export function flattenPage<T>(payload: {
  items: T[];
  meta: { total: number; page: number; pageSize: number; pageCount: number };
}): Paginated<T> {
  return {
    items: payload.items,
    total: payload.meta.total,
    page: payload.meta.page,
    pageSize: payload.meta.pageSize,
    // L'API renvoie `pageCount: 1` sur un résultat vide ; on garde au moins 1
    // pour que « page 1 / 1 » s'affiche plutôt que « page 1 / 0 ».
    pageCount: Math.max(1, payload.meta.pageCount),
  };
}
