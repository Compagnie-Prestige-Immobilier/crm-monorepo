import { useLocation, useNavigate } from '@tanstack/react-router';
import { useCallback, useMemo } from 'react';

export interface AdaptateurFiltres<F> {
  lire: (params: URLSearchParams) => F;
  ecrire: (filtres: F) => URLSearchParams;
  /** Ce que « Tout effacer » laisse en place : le tri choisi, jamais les critères. */
  efface: (courant: F) => F;
}

/**
 * L'URL porte les critères : un lien filtré se copie, et le retour arrière
 * refait la liste précédente sans passer par un état local.
 */
export function useFiltresUrl<F>(adaptateur: AdaptateurFiltres<F>): {
  filtres: F;
  setFiltres: (patch: Partial<F>) => void;
  reinitialiser: () => void;
} {
  const navigate = useNavigate();
  const pathname = useLocation({ select: (etat) => etat.pathname });
  const searchStr = useLocation({ select: (etat) => etat.searchStr });

  const filtres = useMemo(
    () => adaptateur.lire(new URLSearchParams(searchStr)),
    [adaptateur, searchStr],
  );

  const publier = useCallback(
    (suivants: F) => {
      const query = adaptateur.ecrire(suivants).toString();
      void navigate({ href: query === '' ? pathname : `${pathname}?${query}`, replace: true });
    },
    [adaptateur, navigate, pathname],
  );

  const setFiltres = useCallback(
    (patch: Partial<F>) => {
      const remetPremierePage = !Object.hasOwn(patch, 'page');
      publier({ ...filtres, ...(remetPremierePage ? { page: 1 } : {}), ...patch });
    },
    [filtres, publier],
  );

  const reinitialiser = useCallback(() => {
    publier(adaptateur.efface(filtres));
  }, [adaptateur, filtres, publier]);

  return { filtres, setFiltres, reinitialiser };
}

type SansNuls<T> = { [K in keyof T]?: Exclude<T[K], null> };

/**
 * Une requête ne porte que les critères posés : `null` veut dire « aucun
 * filtre », et une clé absente est ce que le serveur attend.
 */
export function sansNuls<T extends Record<string, unknown>>(source: T): SansNuls<T> {
  const sortie: Record<string, unknown> = {};
  for (const [cle, valeur] of Object.entries(source)) {
    if (valeur !== null && valeur !== undefined) sortie[cle] = valeur;
  }
  return sortie as SansNuls<T>;
}

export function lireTexte(params: URLSearchParams, cle: string): string | null {
  const valeur = params.get(cle)?.trim() ?? '';
  return valeur === '' ? null : valeur;
}

export function lireEnum<T extends string>(
  params: URLSearchParams,
  cle: string,
  valeurs: readonly T[],
): T | null {
  const brut = lireTexte(params, cle);
  return brut !== null && (valeurs as readonly string[]).includes(brut) ? (brut as T) : null;
}

export function lireOuiNon(params: URLSearchParams, cle: string): boolean | null {
  const brut = lireTexte(params, cle);
  if (brut === 'oui') return true;
  if (brut === 'non') return false;
  return null;
}

export function lireDate(params: URLSearchParams, cle: string): string | null {
  const brut = lireTexte(params, cle);
  return brut !== null && /^\d{4}-\d{2}-\d{2}$/u.test(brut) ? brut : null;
}

export function lireEntier(params: URLSearchParams, cle: string, defaut: number): number {
  const brut = Number(lireTexte(params, cle));
  return Number.isInteger(brut) && brut > 0 ? brut : defaut;
}
