'use client';

import { useUrlFilters, type UrlFilterAdapter } from '@/components/filters/use-url-filters';
import {
  DEFAULT_CLIENT_REQUEST_FILTERS,
  parseClientRequestFilters,
  serializeClientRequestFilters,
  type ClientRequestFilters,
} from '@/lib/client-request-filters';

/**
 * État de filtre de l'écran d'arbitrage : l'URL, comme partout dans le panel.
 *
 * `cleared` ramène au DÉFAUT (« en attente ») et non à « tous statuts » : « Tout
 * effacer » doit reposer l'écran dans l'état où il sert, celui du travail à
 * faire, pas ouvrir l'historique complet.
 */
const ADAPTER: UrlFilterAdapter<ClientRequestFilters> = {
  parse: parseClientRequestFilters,
  serialize: serializeClientRequestFilters,
  cleared: () => DEFAULT_CLIENT_REQUEST_FILTERS,
};

export function useClientRequestFilters(): {
  filters: ClientRequestFilters;
  setFilters: (patch: Partial<ClientRequestFilters>) => void;
  resetFilters: () => void;
} {
  return useUrlFilters(ADAPTER);
}
