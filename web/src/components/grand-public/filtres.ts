import type { ProspectQuery, ProspectType } from '@/lib/data/console';
import { PROSPECT_STATUTS, PROSPECT_TYPES, type ProspectStatut } from '@/lib/data/grand-public';
import {
  lireDate,
  lireEntier,
  lireEnum,
  lireTexte,
  type AdaptateurFiltres,
} from '@/lib/filtres-url';

export interface FiltresGrandPublic {
  search: string;
  type: ProspectType | null;
  canalProvenanceId: string | null;
  statut: ProspectStatut | null;
  dateFrom: string | null;
  dateTo: string | null;
  page: number;
  pageSize: number;
}

export const TAILLES_PAGE = [25, 50, 100] as const;

const TAILLE_PAGE = 25;

const FILTRES_VIDES: FiltresGrandPublic = {
  search: '',
  type: null,
  canalProvenanceId: null,
  statut: null,
  dateFrom: null,
  dateTo: null,
  page: 1,
  pageSize: TAILLE_PAGE,
};

function lire(params: URLSearchParams): FiltresGrandPublic {
  const pageSize = lireEntier(params, 'pageSize', TAILLE_PAGE);
  return {
    search: lireTexte(params, 'search') ?? '',
    type: lireEnum<ProspectType>(params, 'type', PROSPECT_TYPES),
    canalProvenanceId: lireTexte(params, 'canalProvenanceId'),
    statut: lireEnum<ProspectStatut>(params, 'statut', PROSPECT_STATUTS),
    dateFrom: lireDate(params, 'dateFrom'),
    dateTo: lireDate(params, 'dateTo'),
    page: lireEntier(params, 'page', 1),
    pageSize: (TAILLES_PAGE as readonly number[]).includes(pageSize) ? pageSize : TAILLE_PAGE,
  };
}

function ecrire(filtres: FiltresGrandPublic): URLSearchParams {
  const params = new URLSearchParams();
  const poser = (cle: string, valeur: string | null): void => {
    if (valeur !== null && valeur !== '') params.set(cle, valeur);
  };

  poser('search', filtres.search.trim());
  poser('type', filtres.type);
  poser('canalProvenanceId', filtres.canalProvenanceId);
  poser('statut', filtres.statut);
  poser('dateFrom', filtres.dateFrom);
  poser('dateTo', filtres.dateTo);
  if (filtres.page !== 1) poser('page', String(filtres.page));
  if (filtres.pageSize !== TAILLE_PAGE) poser('pageSize', String(filtres.pageSize));

  return params;
}

export const ADAPTATEUR_GRAND_PUBLIC: AdaptateurFiltres<FiltresGrandPublic> = {
  lire,
  ecrire,
  efface: (courant) => ({ ...FILTRES_VIDES, pageSize: courant.pageSize }),
};

export function compterFiltres(filtres: FiltresGrandPublic): number {
  let total = 0;
  if (filtres.search.trim() !== '') total += 1;
  if (filtres.type !== null) total += 1;
  if (filtres.canalProvenanceId !== null) total += 1;
  if (filtres.statut !== null) total += 1;
  if (filtres.dateFrom !== null || filtres.dateTo !== null) total += 1;
  return total;
}

/**
 * `projet` est posé ICI et nulle part ailleurs : oublié, la liste rendrait
 * aussi les fiches CHUES.
 */
export function versRequete(filtres: FiltresGrandPublic): ProspectQuery {
  const search = filtres.search.trim();
  return {
    projet: 'GRAND_PUBLIC',
    ...(search === '' ? {} : { search }),
    ...(filtres.type === null ? {} : { type: filtres.type }),
    ...(filtres.canalProvenanceId === null ? {} : { canalProvenanceId: filtres.canalProvenanceId }),
    ...(filtres.statut === null ? {} : { statut: filtres.statut }),
    ...(filtres.dateFrom === null ? {} : { dateFrom: filtres.dateFrom }),
    ...(filtres.dateTo === null ? {} : { dateTo: filtres.dateTo }),
    page: filtres.page,
    pageSize: filtres.pageSize,
    sortBy: 'clientCreatedAt',
    sortOrder: 'desc',
  };
}
