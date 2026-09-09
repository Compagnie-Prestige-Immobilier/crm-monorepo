import { estMontant } from '@/components/banque/montant';
import type { RequeteDossiers, RequeteIndicateurs } from '@/lib/data/bank-cases';
import type { RequeteDemandes, StatutDemande } from '@/lib/data/client-requests';
import type { AdaptateurFiltres } from '@/lib/filtres-url';
import { lireDate, lireEntier, lireEnum, lireTexte } from '@/lib/filtres-url';
import type { ProjetApi } from '@/lib/types';

export type TypeEtape = 'OPEN' | 'CASHED' | 'REJECTED';
export type TriDossiers = 'reference' | 'customerName' | 'amountXof' | 'updatedAt';

const TYPES_ETAPE: readonly TypeEtape[] = ['OPEN', 'CASHED', 'REJECTED'];
export const TRIS: readonly TriDossiers[] = ['reference', 'customerName', 'amountXof', 'updatedAt'];

const TAILLE_PAGE = 25;

export interface FiltresDossiers {
  search: string;
  stageId: string | null;
  stageType: TypeEtape | null;
  banqueId: string | null;
  agentId: string | null;
  rejectionReasonId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  amountMin: string | null;
  amountMax: string | null;
  sortBy: TriDossiers;
  sortDir: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

const FILTRES_VIDES: FiltresDossiers = {
  search: '',
  stageId: null,
  stageType: null,
  banqueId: null,
  agentId: null,
  rejectionReasonId: null,
  dateFrom: null,
  dateTo: null,
  amountMin: null,
  amountMax: null,
  sortBy: 'updatedAt',
  sortDir: 'desc',
  page: 1,
  pageSize: TAILLE_PAGE,
};

function lireMontant(params: URLSearchParams, cle: string): string | null {
  const brut = lireTexte(params, cle);
  return brut !== null && estMontant(brut) ? brut : null;
}

function lire(params: URLSearchParams): FiltresDossiers {
  return {
    search: lireTexte(params, 'search') ?? '',
    stageId: lireTexte(params, 'stageId'),
    stageType: lireEnum<TypeEtape>(params, 'stageType', TYPES_ETAPE),
    banqueId: lireTexte(params, 'banqueId'),
    agentId: lireTexte(params, 'agentId'),
    rejectionReasonId: lireTexte(params, 'rejectionReasonId'),
    dateFrom: lireDate(params, 'dateFrom'),
    dateTo: lireDate(params, 'dateTo'),
    amountMin: lireMontant(params, 'amountMin'),
    amountMax: lireMontant(params, 'amountMax'),
    sortBy: lireEnum<TriDossiers>(params, 'sortBy', TRIS) ?? FILTRES_VIDES.sortBy,
    sortDir: lireTexte(params, 'sortDir') === 'asc' ? 'asc' : 'desc',
    page: lireEntier(params, 'page', 1),
    pageSize: TAILLE_PAGE,
  };
}

function ecrire(filtres: FiltresDossiers): URLSearchParams {
  const params = new URLSearchParams();
  const poser = (cle: string, valeur: string | null): void => {
    if (valeur !== null && valeur !== '') params.set(cle, valeur);
  };

  poser('search', filtres.search.trim());
  poser('stageId', filtres.stageId);
  poser('stageType', filtres.stageType);
  poser('banqueId', filtres.banqueId);
  poser('agentId', filtres.agentId);
  poser('rejectionReasonId', filtres.rejectionReasonId);
  poser('dateFrom', filtres.dateFrom);
  poser('dateTo', filtres.dateTo);
  poser('amountMin', filtres.amountMin);
  poser('amountMax', filtres.amountMax);
  if (filtres.sortBy !== FILTRES_VIDES.sortBy) poser('sortBy', filtres.sortBy);
  if (filtres.sortDir !== FILTRES_VIDES.sortDir) poser('sortDir', filtres.sortDir);
  if (filtres.page !== 1) poser('page', String(filtres.page));

  return params;
}

export const ADAPTATEUR_DOSSIERS: AdaptateurFiltres<FiltresDossiers> = {
  lire,
  ecrire,
  efface: (courant) => ({ ...FILTRES_VIDES, sortBy: courant.sortBy, sortDir: courant.sortDir }),
};

export const CLES_AVANCEES = [
  'banqueId',
  'agentId',
  'rejectionReasonId',
  'amountMin',
  'amountMax',
] as const;

export type CleAvancee = (typeof CLES_AVANCEES)[number];

export const LIBELLES_AVANCES: Record<CleAvancee, string> = {
  banqueId: 'Banque de traitement',
  agentId: 'Agent',
  rejectionReasonId: 'Motif de rejet',
  amountMin: 'Montant minimum',
  amountMax: 'Montant maximum',
};

export function effacerAvances(): Partial<FiltresDossiers> {
  return {
    banqueId: null,
    agentId: null,
    rejectionReasonId: null,
    amountMin: null,
    amountMax: null,
  };
}

export function compterFiltres(filtres: FiltresDossiers): number {
  const actifs = [
    filtres.search.trim() !== '',
    filtres.stageId !== null,
    filtres.stageType !== null,
    filtres.banqueId !== null,
    filtres.agentId !== null,
    filtres.rejectionReasonId !== null,
    filtres.dateFrom !== null || filtres.dateTo !== null,
    filtres.amountMin !== null || filtres.amountMax !== null,
  ];
  return actifs.filter(Boolean).length;
}

type Criteres = Omit<RequeteIndicateurs, 'granularity'>;

function criteresIdentite(filtres: FiltresDossiers, projet: ProjetApi): Criteres {
  const query: Criteres = { projet };
  if (filtres.search.trim() !== '') query.search = filtres.search.trim();
  if (filtres.stageId !== null) query.stageId = filtres.stageId;
  if (filtres.stageType !== null) query.stageType = filtres.stageType;
  if (filtres.banqueId !== null) query.banqueId = filtres.banqueId;
  if (filtres.agentId !== null) query.agentId = filtres.agentId;
  return query;
}

function criteresBornes(filtres: FiltresDossiers): Criteres {
  const query: Criteres = {};
  if (filtres.rejectionReasonId !== null) query.rejectionReasonId = filtres.rejectionReasonId;
  if (filtres.dateFrom !== null) query.dateFrom = filtres.dateFrom;
  if (filtres.dateTo !== null) query.dateTo = filtres.dateTo;
  if (filtres.amountMin !== null) query.amountMin = filtres.amountMin;
  if (filtres.amountMax !== null) query.amountMax = filtres.amountMax;
  return query;
}

/** Les critères communs à la liste, aux agrégats et au classeur. */
export function criteres(filtres: FiltresDossiers, projet: ProjetApi): Criteres {
  return { ...criteresIdentite(filtres, projet), ...criteresBornes(filtres) };
}

export function requeteListe(filtres: FiltresDossiers, projet: ProjetApi): RequeteDossiers {
  return {
    ...criteres(filtres, projet),
    page: filtres.page,
    pageSize: filtres.pageSize,
    sortBy: filtres.sortBy,
    sortOrder: filtres.sortDir,
  };
}

/** Le classeur part des critères de l'URL, jamais de la page affichée. */
export function urlClasseur(filtres: FiltresDossiers, projet: ProjetApi): string {
  const params = ecrire(filtres);
  params.delete('page');
  params.delete('sortBy');
  params.delete('sortDir');
  params.set('projet', projet);
  return `/api/v1/export/bank-cases.xlsx?${params.toString()}`;
}

export type VueRapide = 'tous' | 'a-traiter' | 'en-cours' | 'encaisses' | 'rejetes';

export const VUES_RAPIDES: readonly { id: VueRapide; label: string }[] = [
  { id: 'tous', label: 'Tous' },
  { id: 'a-traiter', label: 'À traiter' },
  { id: 'en-cours', label: 'En cours' },
  { id: 'encaisses', label: 'Encaissés' },
  { id: 'rejetes', label: 'Rejetés' },
];

export function correctifVue(
  vue: VueRapide,
  etapeInitiale: string | null,
): Pick<FiltresDossiers, 'stageId' | 'stageType'> {
  if (vue === 'a-traiter') return { stageId: etapeInitiale, stageType: null };
  if (vue === 'en-cours') return { stageId: null, stageType: 'OPEN' };
  if (vue === 'encaisses') return { stageId: null, stageType: 'CASHED' };
  if (vue === 'rejetes') return { stageId: null, stageType: 'REJECTED' };
  return { stageId: null, stageType: null };
}

export function vueCourante(filtres: FiltresDossiers, etapeInitiale: string | null): VueRapide {
  if (filtres.stageId !== null) {
    return filtres.stageId === etapeInitiale ? 'a-traiter' : 'tous';
  }
  if (filtres.stageType === 'OPEN') return 'en-cours';
  if (filtres.stageType === 'CASHED') return 'encaisses';
  if (filtres.stageType === 'REJECTED') return 'rejetes';
  return 'tous';
}

export type StatutFiltre = StatutDemande | 'tous';

const STATUTS: readonly StatutFiltre[] = ['PENDING', 'APPROVED', 'REJECTED', 'tous'];

export interface FiltresDemandes {
  statut: StatutFiltre;
  search: string;
  banqueId: string | null;
  page: number;
  pageSize: number;
}

const DEMANDES_VIDES: FiltresDemandes = {
  statut: 'PENDING',
  search: '',
  banqueId: null,
  page: 1,
  pageSize: TAILLE_PAGE,
};

export const ADAPTATEUR_DEMANDES: AdaptateurFiltres<FiltresDemandes> = {
  lire: (params) => ({
    statut: lireEnum<StatutFiltre>(params, 'statut', STATUTS) ?? DEMANDES_VIDES.statut,
    search: lireTexte(params, 'search') ?? '',
    banqueId: lireTexte(params, 'banqueId'),
    page: lireEntier(params, 'page', 1),
    pageSize: TAILLE_PAGE,
  }),
  ecrire: (filtres) => {
    const params = new URLSearchParams();
    if (filtres.statut !== DEMANDES_VIDES.statut) params.set('statut', filtres.statut);
    if (filtres.search.trim() !== '') params.set('search', filtres.search.trim());
    if (filtres.banqueId !== null) params.set('banqueId', filtres.banqueId);
    if (filtres.page !== 1) params.set('page', String(filtres.page));
    return params;
  },
  efface: () => DEMANDES_VIDES,
};

export function requeteDemandes(filtres: FiltresDemandes): RequeteDemandes {
  return {
    page: filtres.page,
    pageSize: filtres.pageSize,
    ...(filtres.statut === 'tous' ? {} : { status: filtres.statut }),
    ...(filtres.search.trim() === '' ? {} : { search: filtres.search.trim() }),
    ...(filtres.banqueId === null ? {} : { banqueId: filtres.banqueId }),
  };
}

export function compterFiltresDemandes(filtres: FiltresDemandes): number {
  const actifs = [
    filtres.statut !== DEMANDES_VIDES.statut,
    filtres.search.trim() !== '',
    filtres.banqueId !== null,
  ];
  return actifs.filter(Boolean).length;
}
