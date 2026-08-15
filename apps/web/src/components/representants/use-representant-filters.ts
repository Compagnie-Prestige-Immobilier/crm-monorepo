'use client';

import { useUrlFilters, type UrlFilterAdapter } from '@/components/filters/use-url-filters';
import {
  EMPTY_REPRESENTANT_FILTERS,
  parseRepresentantFilters,
  serializeRepresentantFilters,
  type RepresentantFilters,
} from '@/lib/representant-filters';

/**
 * Source unique de l'état de filtre des représentants : l'URL.
 *
 * Adaptateur de MODULE, pas d'objet recréé à chaque rendu : il entre dans les
 * dépendances des callbacks du crochet générique, et une nouvelle référence à
 * chaque rendu relancerait une navigation en boucle.
 */
const ADAPTER: UrlFilterAdapter<RepresentantFilters> = {
  parse: parseRepresentantFilters,
  serialize: serializeRepresentantFilters,
  // Le tri survit à « Tout effacer » : c'est une préférence de lecture, pas un
  // critère. Le remettre à zéro réordonnerait la liste sous les yeux de
  // l'utilisateur, qui n'a demandé qu'à retirer ses filtres.
  cleared: (current) => ({
    ...EMPTY_REPRESENTANT_FILTERS,
    sortBy: current.sortBy,
    sortDir: current.sortDir,
  }),
};

export function useRepresentantFilters(): {
  filters: RepresentantFilters;
  setFilters: (patch: Partial<RepresentantFilters>) => void;
  resetFilters: () => void;
} {
  return useUrlFilters(ADAPTER);
}
