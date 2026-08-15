'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import { EMPTY_FILTERS, parseProspectFilters, serializeProspectFilters } from '@/lib/filters';
import type { ProspectFilters } from '@/lib/types';

/**
 * Source unique de l'état de filtre : l'URL.
 *
 * Trois consommateurs lisent ce même objet : le tableau, les graphiques et le
 * bouton d'export. Les tenir dans un état React local obligerait à les
 * synchroniser à trois, et il suffirait d'un oubli pour qu'un fichier Excel ne
 * corresponde plus à l'écran depuis lequel il a été demandé.
 *
 * Bénéfice secondaire, mais celui que l'utilisateur voit : l'écran filtré est
 * une URL. Elle se colle dans un message, se met en favori, et le bouton
 * « Précédent » défait le dernier filtre.
 */
export function useProspectFilters(): {
  filters: ProspectFilters;
  setFilters: (patch: Partial<ProspectFilters>) => void;
  resetFilters: () => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => parseProspectFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const setFilters = useCallback(
    (patch: Partial<ProspectFilters>) => {
      const next: ProspectFilters = { ...filters, ...patch };

      // Changer un critère remet la pagination à 1 : rester en page 7 d'un
      // résultat qui n'en compte plus que 2 affiche une liste vide et se lit
      // comme un bug.
      const onlyPagination =
        Object.keys(patch).length > 0 &&
        Object.keys(patch).every((key) => key === 'page' || key === 'pageSize');
      if (!onlyPagination) next.page = 1;

      const query = serializeProspectFilters(next).toString();
      router.replace(query === '' ? pathname : `${pathname}?${query}`, { scroll: false });
    },
    [filters, pathname, router],
  );

  const resetFilters = useCallback(() => {
    // La taille de page est une préférence d'affichage, pas un filtre : on la
    // conserve en effaçant les critères.
    const query = serializeProspectFilters({
      ...EMPTY_FILTERS,
      pageSize: filters.pageSize,
    }).toString();
    router.replace(query === '' ? pathname : `${pathname}?${query}`, { scroll: false });
  }, [filters.pageSize, pathname, router]);

  return { filters, setFilters, resetFilters };
}
