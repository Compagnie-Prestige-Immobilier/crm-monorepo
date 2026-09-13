import { apiQuery } from '@crm/api-client/query';

import { getServeurClient, type components } from '@/api/compat/serveur';

export type BaseDemo = components['schemas']['BaseDemoDto'];

const CHEMIN = '/api/v1/admin/bases';

export function basesDemoQuery() {
  return apiQuery(CHEMIN, {}, () => getServeurClient().GET(CHEMIN));
}

export async function creerBaseDemo(nom: string): Promise<void> {
  const { error } = await getServeurClient().POST(CHEMIN, { body: { nom } });
  if (error !== undefined) throw new Error(messageErreur(error));
}

export async function supprimerBaseDemo(nom: string): Promise<void> {
  const { error } = await getServeurClient().DELETE(`${CHEMIN}/{nom}`, {
    params: { path: { nom } },
  });
  if (error !== undefined) throw new Error(messageErreur(error));
}

/** Le serveur dit pourquoi il refuse ; le rejeter sans son message obligerait à deviner. */
function messageErreur(erreur: unknown): string {
  if (typeof erreur === 'object' && erreur !== null && 'message' in erreur) {
    const message = (erreur as { message?: unknown }).message;
    if (typeof message === 'string' && message !== '') return message;
  }
  return 'L’opération a échoué.';
}
