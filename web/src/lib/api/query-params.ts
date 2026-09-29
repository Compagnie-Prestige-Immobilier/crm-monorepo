import type { operations } from '@crm/api-client';

import type { Paginated, ProspectFilters } from '@/lib/types';

export type ProspectQuery = NonNullable<operations['listProspects']['parameters']['query']>;
/** `/api/v1/analytics/totals` a disparu côté Go : les filtres restent ceux, partagés, de `by-banque`. */
export type AnalyticsQuery = NonNullable<operations['getProspectsByBanque']['parameters']['query']>;

// Bornes explicitees: `dateTo=2026-08-12` nu vaut minuit pile et exclut la journee du 12.
// L'heure metier est `Africa/Dakar`, UTC+0 toute l'annee: le `Z` est exact, sans conversion.
function startOfDay(isoDate: string): string {
  return `${isoDate}T00:00:00.000Z`;
}

function endOfDay(isoDate: string): string {
  return `${isoDate}T23:59:59.999Z`;
}

function applyIdentityFilters(query: AnalyticsQuery, filters: ProspectFilters): void {
  if (filters.projet !== null) query.projet = filters.projet;
  const search = filters.search.trim();
  if (search !== '') query.search = search;
  if (filters.commercialId !== null) query.commercialId = filters.commercialId;
  if (filters.representantId !== null) query.representantId = filters.representantId;
  if (filters.departementId !== null) query.departementId = filters.departementId;
  if (filters.banqueId !== null) query.banqueId = filters.banqueId;
  if (filters.syndicatId !== null) query.syndicatId = filters.syndicatId;
}

function applyStatusFilters(query: AnalyticsQuery, filters: ProspectFilters): void {
  if (filters.statut !== null) query.statut = filters.statut;
  if (filters.segment !== null) query.segment = filters.segment;
  // `TOUT` n'existe que pour `/api/v1/prospects` : `toProspectQuery` le repose après coup.
  if (filters.phase2Status !== null && filters.phase2Status !== 'TOUT') {
    query.phase2Status = filters.phase2Status;
  }
  if (filters.enrollmentMethod !== null) query.enrollmentMethod = filters.enrollmentMethod;
  if (filters.enrollmentCapturedById !== null) {
    query.enrollmentCapturedById = filters.enrollmentCapturedById;
  }
  if (filters.revue !== null) query.revue = filters.revue ? 'true' : 'false';
}

function applyDateFilters(query: AnalyticsQuery, filters: ProspectFilters): void {
  if (filters.dateFrom !== null) query.dateFrom = startOfDay(filters.dateFrom);
  if (filters.dateTo !== null) query.dateTo = endOfDay(filters.dateTo);
}

export function toFilterQuery(filters: ProspectFilters): AnalyticsQuery {
  const query: AnalyticsQuery = {};
  applyIdentityFilters(query, filters);
  applyStatusFilters(query, filters);
  applyDateFilters(query, filters);
  return query;
}

export function toProspectQuery(filters: ProspectFilters): ProspectQuery {
  return {
    ...toFilterQuery(filters),
    ...(filters.phase2Status === 'TOUT' ? { phase2Status: 'TOUT' as const } : {}),
    ...(filters.sansMotif === null ? {} : { sansMotif: filters.sansMotif }),
    ...(filters.motif === null ? {} : { motif: filters.motif }),
    ...(filters.campagneId === null ? {} : { campagneId: filters.campagneId }),
    ...(filters.type === null ? {} : { type: filters.type }),
    ...(filters.canalProvenanceId === null ? {} : { canalProvenanceId: filters.canalProvenanceId }),
    ...(filters.origin === null ? {} : { origin: filters.origin }),
    ...(filters.professionId === null ? {} : { professionId: filters.professionId }),
    ...(filters.incomeBandId === null ? {} : { incomeBandId: filters.incomeBandId }),
    ...(filters.employeurId === null ? {} : { employeurId: filters.employeurId }),
    ...(filters.paysResidenceId === null ? {} : { paysResidenceId: filters.paysResidenceId }),
    ...(filters.paymentMode === null ? {} : { paymentMode: filters.paymentMode }),
    ...(filters.typeBien === null ? {} : { typeBien: filters.typeBien }),
    ...(filters.typeContrat === null ? {} : { typeContrat: filters.typeContrat }),
    ...(filters.modeEpargne === null ? {} : { modeEpargne: filters.modeEpargne }),
    ...(filters.rendezVousIssue === null ? {} : { rendezVousIssue: filters.rendezVousIssue }),
    ...(filters.avecRdv === null
      ? {}
      : { avecRdv: filters.avecRdv ? ('true' as const) : ('false' as const) }),
    ...(filters.avecCommentaire === null
      ? {}
      : { avecCommentaire: filters.avecCommentaire ? ('true' as const) : ('false' as const) }),
    ...(filters.appelePar === null ? {} : { appelePar: filters.appelePar }),
    ...(filters.lastCallById === null ? {} : { lastCallById: filters.lastCallById }),
    ...(filters.rdvFrom === null ? {} : { rdvFrom: startOfDay(filters.rdvFrom) }),
    ...(filters.rdvTo === null ? {} : { rdvTo: endOfDay(filters.rdvTo) }),
    page: filters.page,
    pageSize: filters.pageSize,
    sortBy: filters.sortBy,
    sortOrder: filters.sortDir,
  };
}

export interface ListeBornee<T> {
  items: T[];
  tronque: boolean;
}

/** Le serveur pose `tronque` quand il a coupé la liste à son plafond. */
export function estTronque(page: object): boolean {
  return 'tronque' in page && page.tronque === true;
}

export function flattenPage<T>(payload: {
  items: T[];
  meta: { total: number; page: number; pageSize: number; pageCount: number };
}): Paginated<T> {
  return {
    items: payload.items,
    total: payload.meta.total,
    page: payload.meta.page,
    pageSize: payload.meta.pageSize,
    pageCount: Math.max(1, payload.meta.pageCount),
  };
}
