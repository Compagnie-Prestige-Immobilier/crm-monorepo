import { ApiError, apiClient, unwrap } from '@/api/client';
import type { components } from '@/api/schema';
import { apiErrorMessage } from '@/lib/utils';

export type TravailImport = components['schemas']['ImportJobDTO'];
export type RapportImport = components['schemas']['RapportImportDTO'];
export type GenreImport = TravailImport['kind'];

/** Ce qui se dépose depuis cet écran, dans l'ordre de la liste déroulante. */
export const GENRES_DEPOSABLES = [
  'PROSPECTS',
  'PROSPECTS_GRAND_PUBLIC',
  'REPRESENTANTS',
  'VISITES',
] as const;

export type GenreDeposable = (typeof GENRES_DEPOSABLES)[number];

export const LIBELLES_GENRE: Readonly<Record<GenreImport, string>> = {
  REPRESENTANTS: 'Représentants',
  PROSPECTS: 'Prospects CHUES',
  PROSPECTS_GRAND_PUBLIC: 'Prospects Grand Public',
  VISITES: 'Visites',
  VISITES_REGISTRE: 'Registre des visites',
};

export const CONSIGNES_GENRE: Readonly<Record<GenreDeposable, string>> = {
  PROSPECTS:
    'Banque et Syndicat se choisissent dans les listes déroulantes du modèle : leur croisement détermine le groupe. Ce fichier ne crée aucun représentant, importez-les d’abord.',
  PROSPECTS_GRAND_PUBLIC:
    'Seuls le nom et le téléphone sont exigés. Les colonnes sont retrouvées par le texte de leur en-tête, pas par leur rang.',
  REPRESENTANTS:
    'Département et IEF se choisissent dans les listes déroulantes du modèle, tirées des référentiels du jour.',
  VISITES: 'Seuls les onglets « BDD VISITES » sont lus, avec l’en-tête en ligne 3.',
};

const CHEMINS_DEPOT: Readonly<Record<GenreDeposable, string>> = {
  PROSPECTS: '/api/v1/imports/prospects',
  PROSPECTS_GRAND_PUBLIC: '/api/v1/imports/prospects-grand-public',
  REPRESENTANTS: '/api/v1/imports/representants',
  VISITES: '/api/v1/imports/visites',
};

/** Le serveur pose le `Content-Disposition` : un simple lien suffit. */
export const MODELES_GENRE: Readonly<Partial<Record<GenreDeposable, string>>> = {
  PROSPECTS: '/api/v1/export/prospects-modele.xlsx',
  PROSPECTS_GRAND_PUBLIC: '/api/v1/export/prospects-grand-public-modele.xlsx',
  REPRESENTANTS: '/api/v1/export/representants-modele.xlsx',
};

/** Aligné sur la limite du serveur : refuser ici évite un 413. */
export const TAILLE_MAX_OCTETS = 25 * 1024 * 1024;

const PAGE_HISTORIQUE = 10;

export async function fetchTravauxImport(page: number): Promise<{
  items: TravailImport[];
  meta: components['schemas']['MetaPageImports'];
}> {
  const sortie = unwrap(
    await apiClient.GET('/api/v1/imports', {
      params: { query: { page, pageSize: PAGE_HISTORIQUE } },
    }),
  );
  return { items: sortie.items ?? [], meta: sortie.meta };
}

export async function fetchTravailImport(id: string): Promise<TravailImport> {
  return unwrap(await apiClient.GET('/api/v1/imports/{id}', { params: { path: { id } } }));
}

export async function appliquerImport(id: string): Promise<TravailImport> {
  return unwrap(await apiClient.POST('/api/v1/imports/{id}/apply', { params: { path: { id } } }));
}

/**
 * `FormData` brut : le contrat décrit le fichier par une chaîne, et seul le
 * navigateur sait écrire la frontière multipart.
 */
export async function deposerClasseur(
  genre: GenreDeposable,
  fichier: File,
): Promise<TravailImport> {
  const corps = new FormData();
  corps.append('file', fichier);

  const reponse = await fetch(CHEMINS_DEPOT[genre], {
    method: 'POST',
    body: corps,
    credentials: 'same-origin',
  });
  const texte = await reponse.text();
  const charge: unknown = texte === '' ? undefined : JSON.parse(texte);

  if (!reponse.ok) {
    throw new ApiError(
      reponse.status,
      charge,
      apiErrorMessage(charge, 'Le classeur n’a pas pu être déposé.'),
    );
  }
  return charge as TravailImport;
}

/**
 * Le serveur rend `report: null` tant que le classeur n'a pas été lu, alors que
 * le contrat le déclare toujours présent (`imports.go:133`, pointeur non marqué
 * nullable).
 */
export function rapportDe(travail: TravailImport): RapportImport | null {
  const rapport: unknown = travail.report;
  if (rapport === null || rapport === undefined) return null;
  return rapport as RapportImport;
}

export function importEnCours(travail: TravailImport | undefined): boolean {
  return travail?.status === 'queued' || travail?.status === 'running';
}

export function lignesEcrites(travail: TravailImport): number {
  return travail.createdRows + travail.updatedRows;
}

/** Mêmes conditions que le serveur, pour ne pas proposer un geste qui finirait en 409. */
export function peutAppliquer(travail: TravailImport, maintenant = Date.now()): boolean {
  if (travail.status !== 'succeeded' || travail.mode !== 'DRY_RUN') return false;
  if (new Date(travail.expiresAt).getTime() <= maintenant) return false;
  return lignesEcrites(travail) > 0;
}
