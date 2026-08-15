'use client';

import { useUrlFilters, type UrlFilterAdapter } from '@/components/filters/use-url-filters';
import {
  EMPTY_USER_FILTERS,
  parseUserFilters,
  serializeUserFilters,
  type UserFilters,
} from '@/lib/user-filters';

/**
 * Source unique de l'état de filtre des comptes : l'URL.
 *
 * Adaptateur de MODULE, pas d'objet recréé à chaque rendu : il entre dans les
 * dépendances des callbacks du crochet générique.
 */
const ADAPTER: UrlFilterAdapter<UserFilters> = {
  parse: parseUserFilters,
  serialize: serializeUserFilters,
  /**
   * La taille de page SURVIT à « Tout effacer ».
   *
   * C'est une préférence d'affichage, pas un critère : l'effacer changerait la
   * hauteur du tableau au moment précis où l'utilisateur ne demande qu'à
   * retirer ses filtres. Même règle que les prospects et les dossiers
   * (`use-prospect-filters.ts`, `use-bank-filters.ts`), et elle vaut d'être
   * écrite ici même si l'écran n'expose pas encore de sélecteur de taille : le
   * jour où il en offrira un, l'oubli serait silencieux.
   */
  cleared: (current) => ({ ...EMPTY_USER_FILTERS, pageSize: current.pageSize }),
};

export function useUserFilters(): {
  filters: UserFilters;
  setFilters: (patch: Partial<UserFilters>) => void;
  resetFilters: () => void;
} {
  return useUrlFilters(ADAPTER);
}
