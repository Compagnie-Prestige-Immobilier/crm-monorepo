'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

/**
 * L'état de filtre porté par l'URL, pour un écran quelconque.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Pourquoi l'URL, et pas un `useState`.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Les représentants, les campagnes et les comptes gardaient leurs critères dans
 * un état React : la vue filtrée n'était ni partageable, ni remise en place au
 * rechargement, et le bouton « Précédent » sortait de l'écran au lieu de défaire
 * le dernier filtre. Sur les prospects et les dossiers, l'URL est l'état depuis
 * le début (`use-prospect-filters.ts`, `use-bank-filters.ts`) et c'est ce qui
 * permet de coller « les rejets de mars » dans un message.
 *
 * Ces deux écrans-là gardent leur propre crochet : le premier porte la
 * réinitialisation qui conserve la taille de page, le second un constructeur de
 * lien (`hrefWith`) utilisé par le tableau de bord. Ce crochet-ci est la forme
 * générique, pour les écrans qui n'ont besoin que du trio lire / modifier /
 * effacer.
 *
 * L'adaptateur est un objet de MODULE, jamais une valeur recréée à chaque
 * rendu : `parse` et `serialize` entrent dans les dépendances des callbacks.
 */
export interface UrlFilterAdapter<T> {
  parse: (params: URLSearchParams) => T;
  /** Sérialisation canonique : défauts omis, ordre de clés fixe, donc clé de cache. */
  serialize: (filters: T) => URLSearchParams;
  /**
   * Ce que « Tout effacer » laisse en place. La taille de page est une
   * préférence d'affichage, pas un critère : l'effacer surprendrait.
   */
  cleared: (current: T) => T;
}

/**
 * Changer un critère remet la pagination à 1 : rester en page 7 d'un résultat
 * qui n'en compte plus que 2 affiche une liste vide et se lit comme un bug.
 * Un patch qui ne touche QUE la pagination est évidemment épargné.
 */
function withPageReset<T>(next: T, patch: Partial<T>): T {
  const keys = Object.keys(patch);
  if (keys.length === 0) return next;
  if (keys.every((key) => key === 'page' || key === 'pageSize')) return next;
  if (!(typeof next === 'object' && next !== null && 'page' in next)) return next;
  return { ...next, page: 1 };
}

export function useUrlFilters<T>(adapter: UrlFilterAdapter<T>): {
  filters: T;
  setFilters: (patch: Partial<T>) => void;
  resetFilters: () => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => adapter.parse(new URLSearchParams(searchParams.toString())),
    [adapter, searchParams],
  );

  const push = useCallback(
    (next: T) => {
      const query = adapter.serialize(next).toString();
      // `replace` et non `push` : chaque frappe filtrée n'a pas à laisser une
      // entrée dans l'historique, sinon « Précédent » remonte la saisie lettre
      // par lettre.
      router.replace(query === '' ? pathname : `${pathname}?${query}`, { scroll: false });
    },
    [adapter, pathname, router],
  );

  const setFilters = useCallback(
    (patch: Partial<T>) => {
      push(withPageReset({ ...filters, ...patch }, patch));
    },
    [filters, push],
  );

  const resetFilters = useCallback(() => {
    push(adapter.cleared(filters));
  }, [adapter, filters, push]);

  return { filters, setFilters, resetFilters };
}
