import { SEGMENTS } from '@/components/campagnes/cibles';
import type { EnrollmentMethod, Phase2Status, ProjetApi } from '@/lib/data/console';
import type { ProspectStatut } from '@/lib/data/grand-public';
import { PROSPECT_STATUTS } from '@/lib/data/grand-public';
import type { AdaptateurFiltres } from '@/lib/filtres-url';
import { lireDate, lireEntier, lireEnum, lireOuiNon, lireTexte } from '@/lib/filtres-url';

type Segment = (typeof SEGMENTS)[number];

export const PHASE2: readonly Phase2Status[] = [
  'PENDING',
  'METHOD_OBTAINED',
  'REFUSED',
  'WRONG_NUMBER',
];

export const METHODES: readonly EnrollmentMethod[] = [
  'PLATFORM',
  'PHYSICAL',
  'VOICE_OR_ELECTRONIC_MESSAGING',
  'APPOINTMENT',
  'WHATSAPP',
  'RDV_CPI',
  'PLATEFORME_EN_LIGNE',
  'MAIL',
];

export const TRIS = [
  'clientCreatedAt',
  'createdAt',
  'nom',
  'prenom',
  'statut',
  'lastCallAt',
] as const;
export type TriProspects = (typeof TRIS)[number];

export const LIBELLES_TRI: Record<TriProspects, string> = {
  clientCreatedAt: 'Première saisie',
  createdAt: 'Enregistré le',
  nom: 'Nom',
  prenom: 'Prénom',
  statut: 'Statut',
  lastCallAt: 'Dernier appel',
};

export const TAILLES_PAGE = [10, 25, 50, 100] as const;
const TAILLE_PAGE_DEFAUT = 25;

export type FiltresProspects = {
  projet: ProjetApi | null;
  search: string;
  commercialId: string | null;
  representantId: string | null;
  departementId: string | null;
  banqueId: string | null;
  syndicatId: string | null;
  statut: ProspectStatut | null;
  segment: Segment | null;
  phase2Status: Phase2Status | null;
  enrollmentMethod: EnrollmentMethod | null;
  revue: boolean | null;
  dateFrom: string | null;
  dateTo: string | null;
  sortBy: TriProspects;
  sortDir: 'asc' | 'desc';
  page: number;
  pageSize: number;
};

export const FILTRES_VIDES: FiltresProspects = {
  projet: null,
  search: '',
  commercialId: null,
  representantId: null,
  departementId: null,
  banqueId: null,
  syndicatId: null,
  statut: null,
  segment: null,
  phase2Status: null,
  enrollmentMethod: null,
  revue: null,
  dateFrom: null,
  dateTo: null,
  sortBy: 'clientCreatedAt',
  sortDir: 'desc',
  page: 1,
  pageSize: TAILLE_PAGE_DEFAUT,
};

const PROJETS_API: readonly ProjetApi[] = ['CHUES', 'GRAND_PUBLIC'];

function lire(params: URLSearchParams): FiltresProspects {
  const pageSize = lireEntier(params, 'pageSize', TAILLE_PAGE_DEFAUT);
  return {
    projet: lireEnum<ProjetApi>(params, 'projet', PROJETS_API),
    search: lireTexte(params, 'search') ?? '',
    commercialId: lireTexte(params, 'commercialId'),
    representantId: lireTexte(params, 'representantId'),
    departementId: lireTexte(params, 'departementId'),
    banqueId: lireTexte(params, 'banqueId'),
    syndicatId: lireTexte(params, 'syndicatId'),
    statut: lireEnum<ProspectStatut>(params, 'statut', PROSPECT_STATUTS),
    segment: lireEnum<Segment>(params, 'segment', SEGMENTS),
    phase2Status: lireEnum<Phase2Status>(params, 'phase2Status', PHASE2),
    enrollmentMethod: lireEnum<EnrollmentMethod>(params, 'enrollmentMethod', METHODES),
    revue: lireOuiNon(params, 'revue'),
    dateFrom: lireDate(params, 'dateFrom'),
    dateTo: lireDate(params, 'dateTo'),
    sortBy: lireEnum<TriProspects>(params, 'sortBy', TRIS) ?? FILTRES_VIDES.sortBy,
    sortDir: lireTexte(params, 'sortDir') === 'asc' ? 'asc' : 'desc',
    page: lireEntier(params, 'page', 1),
    pageSize: (TAILLES_PAGE as readonly number[]).includes(pageSize)
      ? pageSize
      : TAILLE_PAGE_DEFAUT,
  };
}

function ecrire(filtres: FiltresProspects): URLSearchParams {
  const params = new URLSearchParams();
  const poser = (cle: string, valeur: string | null): void => {
    if (valeur !== null && valeur !== '') params.set(cle, valeur);
  };

  poser('search', filtres.search.trim());
  poser('projet', filtres.projet);
  poser('commercialId', filtres.commercialId);
  poser('representantId', filtres.representantId);
  poser('departementId', filtres.departementId);
  poser('banqueId', filtres.banqueId);
  poser('syndicatId', filtres.syndicatId);
  poser('statut', filtres.statut);
  poser('segment', filtres.segment);
  poser('phase2Status', filtres.phase2Status);
  poser('enrollmentMethod', filtres.enrollmentMethod);
  if (filtres.revue !== null) poser('revue', filtres.revue ? 'oui' : 'non');
  poser('dateFrom', filtres.dateFrom);
  poser('dateTo', filtres.dateTo);
  if (filtres.page !== 1) poser('page', String(filtres.page));
  if (filtres.pageSize !== TAILLE_PAGE_DEFAUT) poser('pageSize', String(filtres.pageSize));
  if (filtres.sortBy !== FILTRES_VIDES.sortBy) poser('sortBy', filtres.sortBy);
  if (filtres.sortDir !== FILTRES_VIDES.sortDir) poser('sortDir', filtres.sortDir);

  return params;
}

export const ADAPTATEUR_PROSPECTS: AdaptateurFiltres<FiltresProspects> = {
  lire,
  ecrire,
  efface: (courant) => ({
    ...FILTRES_VIDES,
    projet: courant.projet,
    pageSize: courant.pageSize,
    sortBy: courant.sortBy,
    sortDir: courant.sortDir,
  }),
};

const CLES_AVANCEES = [
  'representantId',
  'departementId',
  'banqueId',
  'syndicatId',
  'statut',
  'segment',
  'phase2Status',
  'enrollmentMethod',
  'revue',
] as const;

export type CleAvancee = (typeof CLES_AVANCEES)[number];

export function effacerAvances(): Partial<FiltresProspects> {
  return {
    representantId: null,
    departementId: null,
    banqueId: null,
    syndicatId: null,
    statut: null,
    segment: null,
    phase2Status: null,
    enrollmentMethod: null,
    revue: null,
  };
}

export function compterFiltres(filtres: FiltresProspects): number {
  const actifs = [
    filtres.search.trim() !== '',
    filtres.commercialId !== null,
    filtres.representantId !== null,
    filtres.departementId !== null,
    filtres.banqueId !== null,
    filtres.syndicatId !== null,
    filtres.statut !== null,
    filtres.segment !== null,
    filtres.phase2Status !== null,
    filtres.enrollmentMethod !== null,
    filtres.revue !== null,
    filtres.dateFrom !== null || filtres.dateTo !== null,
  ];
  return actifs.filter(Boolean).length;
}

export function urlExport(filtres: FiltresProspects): string {
  const params = ecrire(filtres);
  params.delete('page');
  params.delete('pageSize');
  const query = params.toString();
  return query === '' ? '/api/v1/export/prospects.xlsx' : `/api/v1/export/prospects.xlsx?${query}`;
}
