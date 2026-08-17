'use client';

import { useUrlFilters, type UrlFilterAdapter } from '@/components/filters/use-url-filters';
import {
  DEFAULT_CLIENT_REQUEST_FILTERS,
  parseClientRequestFilters,
  serializeClientRequestFilters,
  type ClientRequestFilters,
} from '@/lib/client-request-filters';

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
