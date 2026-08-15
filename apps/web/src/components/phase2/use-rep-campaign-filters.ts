'use client';

import { useUrlFilters, type UrlFilterAdapter } from '@/components/filters/use-url-filters';
import {
  EMPTY_REP_CAMPAIGN_FILTERS,
  parseRepCampaignFilters,
  serializeRepCampaignFilters,
  type RepCampaignFilters,
} from '@/lib/rep-campaign-filters';

/**
 * État de filtre des campagnes représentants : l'URL, comme partout.
 *
 * L'onglet est une ROUTE (`/campagnes/representants`) et non un paramètre :
 * `useUrlFilters` réécrit la chaîne de requête entière, donc deux listes
 * filtrables dans la même URL se marcheraient dessus au premier « Tout
 * effacer ». Le découpage par route règle le problème à la racine, et rend en
 * prime chaque onglet partageable tel quel.
 */
const ADAPTER: UrlFilterAdapter<RepCampaignFilters> = {
  parse: parseRepCampaignFilters,
  serialize: serializeRepCampaignFilters,
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
  cleared: (current) => ({ ...EMPTY_REP_CAMPAIGN_FILTERS, pageSize: current.pageSize }),
};

export function useRepCampaignFilters(): {
  filters: RepCampaignFilters;
  setFilters: (patch: Partial<RepCampaignFilters>) => void;
  resetFilters: () => void;
} {
  return useUrlFilters(ADAPTER);
}
