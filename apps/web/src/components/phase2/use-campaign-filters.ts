'use client';

import { useUrlFilters, type UrlFilterAdapter } from '@/components/filters/use-url-filters';
import {
  EMPTY_CAMPAIGN_FILTERS,
  parseCampaignFilters,
  serializeCampaignFilters,
  type CampaignFilters,
} from '@/lib/campaign-filters';

/**
 * Source unique de l'état de filtre des campagnes : l'URL.
 *
 * Adaptateur de MODULE, pas d'objet recréé à chaque rendu : il entre dans les
 * dépendances des callbacks du crochet générique.
 */
const ADAPTER: UrlFilterAdapter<CampaignFilters> = {
  parse: parseCampaignFilters,
  serialize: serializeCampaignFilters,
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
  cleared: (current) => ({ ...EMPTY_CAMPAIGN_FILTERS, pageSize: current.pageSize }),
};

export function useCampaignFilters(): {
  filters: CampaignFilters;
  setFilters: (patch: Partial<CampaignFilters>) => void;
  resetFilters: () => void;
} {
  return useUrlFilters(ADAPTER);
}
