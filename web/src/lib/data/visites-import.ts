import { ApiError, apiClient, unwrap } from '@/api/client';
import type { components } from '@/api/schema';
import { apiErrorMessage } from '@/lib/utils';

export type TravailRegistre = components['schemas']['ImportJobSortie'];
export type ChangementRegistre = components['schemas']['ChangeImportSortie'];
export type RapportRegistre = components['schemas']['RapportImport'];

/** Aligné sur la limite du serveur : refuser ici évite un 413 sans message. */
export const TAILLE_MAX_OCTETS = 25 * 1024 * 1024;

const PAGE_REVUE = 50;

export async function deposerRegistre(fichier: File): Promise<TravailRegistre> {
  const corps = new FormData();
  corps.append('file', fichier);

  const reponse = await fetch('/api/v1/visites/import', {
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
  return charge as TravailRegistre;
}

export async function fetchTravailRegistre(id: string): Promise<TravailRegistre> {
  return unwrap(await apiClient.GET('/api/v1/visites/import/{id}', { params: { path: { id } } }));
}

export async function fetchRevueRegistre(
  id: string,
  page: number,
  pageSize = PAGE_REVUE,
): Promise<{ items: ChangementRegistre[]; meta: components['schemas']['PageRegistre'] }> {
  const revue = unwrap(
    await apiClient.GET('/api/v1/visites/import/{id}/revue', {
      params: { path: { id }, query: { page, pageSize } },
    }),
  );
  return { items: revue.items ?? [], meta: revue.meta };
}

export async function choisirLignesRegistre(
  id: string,
  ids: string[],
  selected: boolean,
): Promise<void> {
  unwrap(
    await apiClient.PATCH('/api/v1/visites/import/{id}/revue', {
      params: { path: { id } },
      body: { ids, selected },
    }),
  );
}

export async function appliquerRegistre(id: string): Promise<TravailRegistre> {
  return unwrap(
    await apiClient.POST('/api/v1/visites/import/{id}/apply', { params: { path: { id } } }),
  );
}

/** Le serveur rend `report: null` tant que le classeur n'a pas été lu. */
export function rapportDe(travail: TravailRegistre): RapportRegistre | null {
  const rapport: unknown = travail.report;
  return rapport === null || rapport === undefined ? null : (rapport as RapportRegistre);
}

/** Créations et corrections seules composent la revue : les lignes inchangées n'y figurent pas. */
export function differences(travail: TravailRegistre): number {
  return travail.createdRows + travail.updatedRows;
}

/** Mêmes conditions que le serveur, pour ne pas proposer un geste qui finirait en 409. */
export function peutAppliquer(
  travail: TravailRegistre | undefined,
  choisies: number,
  maintenant = Date.now(),
): boolean {
  if (travail === undefined || travail.status !== 'succeeded' || travail.mode !== 'DRY_RUN') {
    return false;
  }
  if (new Date(travail.expiresAt).getTime() <= maintenant) return false;
  return choisies > 0;
}
