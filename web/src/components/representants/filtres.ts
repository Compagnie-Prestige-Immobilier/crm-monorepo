import type { AdaptateurFiltres } from '@/lib/filtres-url';
import { lireDate, lireEntier, lireEnum, lireOuiNon, lireTexte } from '@/lib/filtres-url';

export type RelationRepresentant = 'INCONNU' | 'CONTACTE' | 'AMBASSADEUR' | 'REFUS';

const RELATIONS: readonly RelationRepresentant[] = ['INCONNU', 'CONTACTE', 'AMBASSADEUR', 'REFUS'];

/**
 * Même vocabulaire que les statuts de qualification : la relation se lit comme
 * un statut. La valeur envoyée à l'API, elle, ne bouge pas.
 */
export const LIBELLES_RELATION: Record<RelationRepresentant, string> = {
  INCONNU: 'Non qualifié',
  CONTACTE: 'Contacté',
  AMBASSADEUR: 'Accepté',
  REFUS: 'Refusé',
};

/** CONTACTE n'est pas proposé : à côté de « a accepté », il s'y confondait. */
export const CHOIX_RELATION: readonly RelationRepresentant[] = ['INCONNU', 'AMBASSADEUR', 'REFUS'];

export const TRIS = ['clientCreatedAt', 'fullName', 'prospects', 'priorite'] as const;

export type TriRepresentants = (typeof TRIS)[number];

export const LIBELLES_TRI: Record<TriRepresentants, string> = {
  clientCreatedAt: 'Première saisie',
  fullName: 'Nom',
  prospects: 'Nombre de prospects',
  priorite: 'Priorité de traitement',
};

export type FiltresRepresentants = {
  search: string;
  departementId: string | null;
  iefId: string | null;
  commercialId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  hasProspects: boolean | null;
  relationStatus: RelationRepresentant | null;
  statutQualificationId: string | null;
  sortBy: TriRepresentants;
  sortDir: 'asc' | 'desc';
  page: number;
  pageSize: number;
};

const TAILLE_PAGE = 25;

export const FILTRES_VIDES: FiltresRepresentants = {
  search: '',
  departementId: null,
  iefId: null,
  commercialId: null,
  dateFrom: null,
  dateTo: null,
  hasProspects: null,
  relationStatus: null,
  statutQualificationId: null,
  sortBy: 'clientCreatedAt',
  sortDir: 'desc',
  page: 1,
  pageSize: TAILLE_PAGE,
};

function lire(params: URLSearchParams): FiltresRepresentants {
  return {
    search: lireTexte(params, 'search') ?? '',
    departementId: lireTexte(params, 'departementId'),
    iefId: lireTexte(params, 'iefId'),
    commercialId: lireTexte(params, 'commercialId'),
    dateFrom: lireDate(params, 'dateFrom'),
    dateTo: lireDate(params, 'dateTo'),
    hasProspects: lireOuiNon(params, 'hasProspects'),
    relationStatus: lireEnum<RelationRepresentant>(params, 'relationStatus', RELATIONS),
    statutQualificationId: lireTexte(params, 'statutQualificationId'),
    sortBy: lireEnum<TriRepresentants>(params, 'sortBy', TRIS) ?? FILTRES_VIDES.sortBy,
    sortDir: lireTexte(params, 'sortDir') === 'asc' ? 'asc' : 'desc',
    page: lireEntier(params, 'page', 1),
    pageSize: TAILLE_PAGE,
  };
}

function ecrire(filtres: FiltresRepresentants): URLSearchParams {
  const params = new URLSearchParams();
  const poser = (cle: string, valeur: string | null): void => {
    if (valeur !== null && valeur !== '') params.set(cle, valeur);
  };

  poser('search', filtres.search.trim());
  poser('departementId', filtres.departementId);
  poser('iefId', filtres.iefId);
  poser('commercialId', filtres.commercialId);
  poser('dateFrom', filtres.dateFrom);
  poser('dateTo', filtres.dateTo);
  if (filtres.hasProspects !== null) poser('hasProspects', filtres.hasProspects ? 'oui' : 'non');
  poser('relationStatus', filtres.relationStatus);
  poser('statutQualificationId', filtres.statutQualificationId);
  if (filtres.sortBy !== FILTRES_VIDES.sortBy) poser('sortBy', filtres.sortBy);
  if (filtres.sortDir !== FILTRES_VIDES.sortDir) poser('sortDir', filtres.sortDir);
  if (filtres.page !== 1) poser('page', String(filtres.page));

  return params;
}

export const ADAPTATEUR_REPRESENTANTS: AdaptateurFiltres<FiltresRepresentants> = {
  lire,
  ecrire,
  efface: (courant) => ({
    ...FILTRES_VIDES,
    sortBy: courant.sortBy,
    sortDir: courant.sortDir,
  }),
};

const CLES_AVANCEES = ['dateFrom', 'dateTo', 'hasProspects'] as const;

export type CleAvancee = (typeof CLES_AVANCEES)[number];

export function effacerAvances(): Partial<FiltresRepresentants> {
  return { dateFrom: null, dateTo: null, hasProspects: null };
}

export function compterFiltres(filtres: FiltresRepresentants): number {
  const actifs = [
    filtres.search.trim() !== '',
    filtres.departementId !== null,
    filtres.iefId !== null,
    filtres.commercialId !== null,
    filtres.dateFrom !== null || filtres.dateTo !== null,
    filtres.hasProspects !== null,
    filtres.relationStatus !== null,
    filtres.statutQualificationId !== null,
  ];
  return actifs.filter(Boolean).length;
}

/** L'export part des critères de l'URL, pas de la page affichée. */
export function urlExport(filtres: FiltresRepresentants, mode: 'filtre' | 'tout'): string {
  const params = mode === 'tout' ? new URLSearchParams() : ecrire(filtres);
  params.delete('page');
  params.delete('sortBy');
  params.delete('sortDir');
  const query = params.toString();
  return query === ''
    ? '/api/v1/export/representants.xlsx'
    : `/api/v1/export/representants.xlsx?${query}`;
}
