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
 * le dernier filtre. Voir `TRANSIENT_KEYS` plus bas pour la seconde moitié de
 * cette promesse, celle qui manquait. Sur les prospects et les dossiers, l'URL est l'état depuis
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
 * ═══════════════════════════════════════════════════════════════════════════
 * Une entrée d'historique par CRITÈRE, aucune par frappe.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le commentaire de ce module annonçait, comme un défaut corrigé, que
 * « Précédent » défait le dernier filtre. Tout passait pourtant par
 * `router.replace`, qui garantit exactement le contraire : aucune entrée n'était
 * empilée, et « Précédent » quittait l'écran, ce que le module disait réparer.
 *
 * `push` partout n'est pas la réponse non plus : le champ de recherche écrit à
 * chaque frappe (débounce compris), et « Précédent » remonterait alors la saisie
 * lettre par lettre, sur dix ou vingt entrées, avant de sortir de l'écran. Ce
 * serait un second défaut à la place du premier.
 *
 * On distingue donc les deux natures de changement :
 *
 *  - un critère CHOISI (une banque, un statut, une période, un tri, une page) :
 *    un geste unique, discret, que l'utilisateur peut vouloir défaire. Il empile
 *    une entrée ;
 *  - un critère TAPÉ (le champ de recherche) : un flux continu de valeurs
 *    intermédiaires dont aucune n'est un état auquel on revient. Il remplace.
 *
 * `TRANSIENT_KEYS` liste les seconds. Un patch qui ne touche QUE ces clés
 * remplace ; tout le reste empile.
 */
const TRANSIENT_KEYS: readonly string[] = ['search'];

export function isTransientPatch(patch: object): boolean {
  const keys = Object.keys(patch);
  if (keys.length === 0) return true;
  return keys.every((key) => TRANSIENT_KEYS.includes(key));
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

  const navigate = useCallback(
    (next: T, transient: boolean) => {
      const query = adapter.serialize(next).toString();
      const url = query === '' ? pathname : `${pathname}?${query}`;
      if (transient) {
        router.replace(url, { scroll: false });
      } else {
        router.push(url, { scroll: false });
      }
    },
    [adapter, pathname, router],
  );

  const setFilters = useCallback(
    (patch: Partial<T>) => {
      navigate(withPageReset({ ...filters, ...patch }, patch), isTransientPatch(patch));
    },
    [filters, navigate],
  );

  // « Tout effacer » est un geste délibéré, et l'un des plus regrettés : il doit
  // pouvoir se défaire d'un « Précédent ».
  const resetFilters = useCallback(() => {
    navigate(adapter.cleared(filters), false);
  }, [adapter, filters, navigate]);

  return { filters, setFilters, resetFilters };
}
