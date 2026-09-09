import { apiClient, unwrap } from '@/api/client';
import type { components } from '@/api/schema';

export type CataloguePurge = components['schemas']['CataloguePurgeOutputBody'];
export type DomainePurge = components['schemas']['DomainePurge'];
export type ClePurge = DomainePurge['key'];

export async function fetchCataloguePurge(): Promise<CataloguePurge> {
  return unwrap(await apiClient.GET('/api/v1/admin/purge'));
}

export async function purger(
  domains: readonly ClePurge[],
  confirmation: string,
): Promise<components['schemas']['PurgerOutputBody']> {
  return unwrap(
    await apiClient.POST('/api/v1/admin/purge', { body: { domains: [...domains], confirmation } }),
  );
}

/** Un domaine en entraîne d'autres : `requires` se referme sur lui-même. */
export function etendreSelection(
  choisis: readonly ClePurge[],
  domaines: readonly DomainePurge[],
): ClePurge[] {
  const parCle = new Map(domaines.map((domaine) => [domaine.key as string, domaine]));
  const resolus = new Set<string>();
  const attente: string[] = [...choisis];

  while (attente.length > 0) {
    const cle = attente.pop();
    if (cle === undefined || resolus.has(cle)) continue;
    resolus.add(cle);
    attente.push(...(parCle.get(cle)?.requires ?? []));
  }

  return domaines.map((domaine) => domaine.key).filter((cle) => resolus.has(cle));
}

export function domainesEntraines(
  choisis: readonly ClePurge[],
  domaines: readonly DomainePurge[],
): ClePurge[] {
  const explicites = new Set<string>(choisis);
  return etendreSelection(choisis, domaines).filter((cle) => !explicites.has(cle));
}

export function lignesDeLaSelection(
  choisis: readonly ClePurge[],
  domaines: readonly DomainePurge[],
): number {
  const etendus = new Set<string>(etendreSelection(choisis, domaines));
  return domaines
    .filter((domaine) => etendus.has(domaine.key))
    .reduce((somme, domaine) => somme + domaine.rows, 0);
}

export function purgeSoumettable(entree: {
  catalogue: CataloguePurge;
  choisis: readonly ClePurge[];
  confirmation: string;
  enCours: boolean;
}): boolean {
  if (entree.enCours || !entree.catalogue.allowed || entree.choisis.length === 0) return false;
  const saisie = entree.confirmation.trim().toLocaleLowerCase();
  return saisie !== '' && saisie === entree.catalogue.confirmationHint.trim().toLocaleLowerCase();
}
