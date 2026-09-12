import { apiQuery } from '@crm/api-client/query';

import { getServeurClient } from '@/api/compat/serveur';

const CHEMIN = '/api/v1/formulaire-public/mon-lien';

/**
 * Le jeton du lien public, propre au compte et régénérable. Il portait
 * l'identifiant du compte : le lien ne se révoquait qu'en fermant le compte.
 */
export function monLienFormulaireQuery() {
  return apiQuery(CHEMIN, {}, () => getServeurClient().GET(CHEMIN));
}

export async function regenererMonLienFormulaire(): Promise<string> {
  const { data, error } = await getServeurClient().POST(`${CHEMIN}/rotation`);
  if (error !== undefined) throw new Error('Le lien n’a pas pu être régénéré.');
  return data.jeton;
}
