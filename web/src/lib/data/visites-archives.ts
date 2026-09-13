import { apiQuery } from '@crm/api-client/query';

import { getServeurClient } from '@/api/compat/serveur';

const CHEMIN = '/api/v1/visites/{id}';
const LISTE = '/api/v1/visites';

/**
 * Archivage et destruction ne sont pas au contrat v1 figé : ils passent par le
 * contrat que le binaire Go engendre.
 */
export async function archiverVisite(id: string): Promise<void> {
  const { error } = await getServeurClient().DELETE(CHEMIN, { params: { path: { id } } });
  if (error !== undefined) throw new Error('La visite n’a pas pu être archivée.');
}

export async function detruireVisite(id: string): Promise<void> {
  const { error } = await getServeurClient().DELETE(`${CHEMIN}/definitif`, {
    params: { path: { id } },
  });
  if (error !== undefined) throw new Error(messageErreur(error));
}

/** Réservé à la direction : le serveur refuse la demande aux autres rôles. */
export function visitesArchiveesQuery(page: number, pageSize: number) {
  const query = { archivees: true, page, pageSize };
  return apiQuery(`${LISTE}:archives`, query, () =>
    getServeurClient().GET(LISTE, { params: { query } }),
  );
}

function messageErreur(erreur: unknown): string {
  if (typeof erreur === 'object' && erreur !== null && 'message' in erreur) {
    const message = (erreur as { message?: unknown }).message;
    if (typeof message === 'string' && message !== '') return message;
  }
  return 'La destruction a échoué.';
}
