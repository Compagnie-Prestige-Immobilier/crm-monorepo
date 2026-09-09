import { apiClient, unwrap } from '@/api/client';
import type { components, operations } from '@/api/schema';
import { lireDate, lireEntier, lireEnum, lireTexte } from '@/lib/filtres-url';

export type Visite = components['schemas']['Visite'];
export type VisiteRef = components['schemas']['VisiteRef'];
export type EntreeReferentielVisite = components['schemas']['EntreeReferentielVisite'];
export type ReferentielsVisite = components['schemas']['ReferentielsVisiteOutputBody'];
export type CreerVisite = components['schemas']['CreerVisiteInputBody'];
export type CorrigerVisite = components['schemas']['CorrigerVisiteInputBody'];
export type PageRegistre = components['schemas']['PageRegistre'];

type RequeteVisites = NonNullable<operations['listVisites']['parameters']['query']>;

export const TRIS_VISITE = [
  'visitedAt',
  'visitorName',
  'entreprise',
  'direction',
  'destinataire',
  'objet',
] as const;

export type TriVisite = (typeof TRIS_VISITE)[number];

/** Les intitulés du classeur tenu depuis des années par l'accueil. On n'y touche pas. */
export const COLONNES_VISITE = {
  date: 'DATE VISITE',
  time: 'HEURE VISITE',
  visitorName: 'PRENOM ET NOMS',
  phone: 'TELEPHONES',
  entreprise: 'ENTREPRISE',
  direction: 'DIRECTION',
  destinataire: 'DESTINATAIRES',
  objet: 'OBJET VISITE',
  comment: 'COMMENTAIRES / NOTES',
} as const;

export const COLONNES_IMPRESSION = [
  'N° REGISTRE',
  COLONNES_VISITE.date,
  COLONNES_VISITE.time,
  COLONNES_VISITE.visitorName,
  COLONNES_VISITE.phone,
  COLONNES_VISITE.entreprise,
  COLONNES_VISITE.direction,
  COLONNES_VISITE.destinataire,
  COLONNES_VISITE.objet,
  COLONNES_VISITE.comment,
] as const;

export type ColonneImpression = (typeof COLONNES_IMPRESSION)[number];

/** Sans elles, la feuille n'identifie plus ni le jour ni la personne : ce n'est plus un registre. */
export const COLONNES_IMPRESSION_VERROUILLEES: readonly ColonneImpression[] = [
  COLONNES_VISITE.date,
  COLONNES_VISITE.visitorName,
];

export function basculerColonneImpression(
  colonnes: ReadonlySet<ColonneImpression>,
  colonne: ColonneImpression,
): ReadonlySet<ColonneImpression> {
  if (COLONNES_IMPRESSION_VERROUILLEES.includes(colonne)) return colonnes;
  const suite = new Set(colonnes);
  if (suite.has(colonne)) suite.delete(colonne);
  else suite.add(colonne);
  return suite;
}

/** `search` exige deux caractères ; en dessous le serveur refuse la requête. */
const RECHERCHE_MIN = 2;
const TAILLE_PAGE = 100;

export interface FiltresVisite {
  search: string;
  entrepriseId: string | null;
  directionId: string | null;
  destinataireId: string | null;
  objetId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  toutePeriode: boolean;
  page: number;
  pageSize: number;
  sortBy: TriVisite;
  sortDir: 'asc' | 'desc';
}

export const FILTRES_VISITE_VIDES: FiltresVisite = {
  search: '',
  entrepriseId: null,
  directionId: null,
  destinataireId: null,
  objetId: null,
  dateFrom: null,
  dateTo: null,
  toutePeriode: false,
  page: 1,
  pageSize: TAILLE_PAGE,
  sortBy: 'visitedAt',
  sortDir: 'desc',
};

export function lireFiltresVisite(params: URLSearchParams): FiltresVisite {
  return {
    search: lireTexte(params, 'search') ?? '',
    entrepriseId: lireTexte(params, 'entrepriseId'),
    directionId: lireTexte(params, 'directionId'),
    destinataireId: lireTexte(params, 'destinataireId'),
    objetId: lireTexte(params, 'objetId'),
    dateFrom: lireDate(params, 'dateFrom'),
    dateTo: lireDate(params, 'dateTo'),
    toutePeriode: lireTexte(params, 'periode') === 'tout',
    page: lireEntier(params, 'page', 1),
    pageSize: TAILLE_PAGE,
    sortBy: lireEnum(params, 'sortBy', TRIS_VISITE) ?? 'visitedAt',
    sortDir: lireTexte(params, 'sortDir') === 'asc' ? 'asc' : 'desc',
  };
}

export function ecrireFiltresVisite(filtres: FiltresVisite): URLSearchParams {
  const params = new URLSearchParams();
  const poser = (cle: string, valeur: string | null): void => {
    if (valeur !== null && valeur !== '') params.set(cle, valeur);
  };

  poser('search', filtres.search.trim());
  poser('entrepriseId', filtres.entrepriseId);
  poser('directionId', filtres.directionId);
  poser('destinataireId', filtres.destinataireId);
  poser('objetId', filtres.objetId);
  poser('dateFrom', filtres.dateFrom);
  poser('dateTo', filtres.dateTo);
  if (filtres.toutePeriode) params.set('periode', 'tout');
  if (filtres.page !== 1) params.set('page', String(filtres.page));
  if (filtres.sortBy !== 'visitedAt') params.set('sortBy', filtres.sortBy);
  if (filtres.sortDir !== 'desc') params.set('sortDir', filtres.sortDir);
  return params;
}

export function compterFiltresVisite(filtres: FiltresVisite): number {
  const poses = [
    filtres.search.trim() !== '',
    filtres.entrepriseId !== null,
    filtres.directionId !== null,
    filtres.destinataireId !== null,
    filtres.objetId !== null,
    filtres.dateFrom !== null || filtres.dateTo !== null || filtres.toutePeriode,
  ];
  return poses.filter(Boolean).length;
}

/** Dakar est à UTC toute l'année : l'horloge du serveur et la sienne coïncident. */
export function maintenantDakar(at: Date = new Date()): { date: string; time: string } {
  const deux = (valeur: number): string => String(valeur).padStart(2, '0');
  return {
    date: `${String(at.getUTCFullYear())}-${deux(at.getUTCMonth() + 1)}-${deux(at.getUTCDate())}`,
    time: `${deux(at.getUTCHours())}:${deux(at.getUTCMinutes())}`,
  };
}

/** La plus récente en haut : c'est l'ordre du classeur, et celui de la journée. */
export function ordonnerVisites(items: readonly Visite[]): Visite[] {
  return [...items].sort((a, b) =>
    `${b.date} ${b.time ?? ''}`.localeCompare(`${a.date} ${a.time ?? ''}`),
  );
}

/**
 * Ce que la correction envoie : les seuls champs touchés. Renvoyer une valeur
 * inchangée ferait rejeter la ligne dès qu'une entrée de référentiel a été
 * retirée depuis, alors qu'un tout autre champ était corrigé.
 */
/** Vide et absent sont la même chose pour le serveur : les deux effacent le champ. */
function ouNull(valeur: string | null | undefined): string | null {
  if (valeur === undefined || valeur === null || valeur.trim() === '') return null;
  return valeur;
}

function idOuNull(ref: VisiteRef | null | undefined): string | null {
  return ref === undefined || ref === null ? null : ref.id;
}

export function correctionVisite(avant: Visite, apres: CreerVisite): CorrigerVisite {
  const etatAvant: CorrigerVisite = {
    time: ouNull(avant.time),
    visitorName: avant.visitorName,
    phone: ouNull(avant.phone),
    entrepriseId: avant.entreprise.id,
    objetId: avant.objet.id,
    directionId: idOuNull(avant.direction),
    destinataireId: idOuNull(avant.destinataire),
    comment: ouNull(avant.comment),
  };
  const etatApres: CorrigerVisite = {
    time: ouNull(apres.time),
    visitorName: apres.visitorName,
    phone: ouNull(apres.phone),
    entrepriseId: apres.entrepriseId,
    objetId: apres.objetId,
    directionId: ouNull(apres.directionId),
    destinataireId: ouNull(apres.destinataireId),
    comment: ouNull(apres.comment),
  };

  return Object.fromEntries(
    Object.entries(etatApres).filter(
      ([cle, valeur]) => etatAvant[cle as keyof CorrigerVisite] !== valeur,
    ),
  ) as CorrigerVisite;
}

/** Sans date choisie ni registre entier demandé, le registre est celui du jour. */
function plageDe(filtres: FiltresVisite, aujourdhui: string): { from?: string; to?: string } {
  if (filtres.dateFrom !== null || filtres.dateTo !== null) {
    return {
      ...(filtres.dateFrom === null ? {} : { from: filtres.dateFrom }),
      ...(filtres.dateTo === null ? {} : { to: filtres.dateTo }),
    };
  }
  if (filtres.toutePeriode) return {};
  return { from: aujourdhui, to: aujourdhui };
}

function requete(filtres: FiltresVisite, aujourdhui: string): RequeteVisites {
  const recherche = filtres.search.trim();
  return {
    page: filtres.page,
    pageSize: filtres.pageSize,
    sortBy: filtres.sortBy,
    sortOrder: filtres.sortDir,
    ...plageDe(filtres, aujourdhui),
    ...(filtres.entrepriseId === null ? {} : { entrepriseId: filtres.entrepriseId }),
    ...(filtres.directionId === null ? {} : { directionId: filtres.directionId }),
    ...(filtres.destinataireId === null ? {} : { destinataireId: filtres.destinataireId }),
    ...(filtres.objetId === null ? {} : { objetId: filtres.objetId }),
    ...(recherche.length < RECHERCHE_MIN ? {} : { search: recherche }),
  };
}

export async function fetchVisites(
  filtres: FiltresVisite,
  aujourdhui: string,
): Promise<{ items: Visite[]; meta: PageRegistre }> {
  const page = unwrap(
    await apiClient.GET('/api/v1/visites', { params: { query: requete(filtres, aujourdhui) } }),
  );
  return { items: page.items ?? [], meta: page.meta };
}

export async function fetchReferentielsVisite(activeOnly = true): Promise<ReferentielsVisite> {
  return unwrap(
    await apiClient.GET('/api/v1/visites/referentiels', { params: { query: { activeOnly } } }),
  );
}

export async function creerVisite(body: CreerVisite): Promise<Visite> {
  return unwrap(await apiClient.POST('/api/v1/visites', { body }));
}

export async function corrigerVisite(id: string, body: CorrigerVisite): Promise<Visite> {
  return unwrap(await apiClient.PATCH('/api/v1/visites/{id}', { params: { path: { id } }, body }));
}
