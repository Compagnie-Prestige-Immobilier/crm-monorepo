'use client';

import { useUrlFilters, type UrlFilterAdapter } from '@/components/filters/use-url-filters';
import {
  EMPTY_REPRESENTANT_FILTERS,
  parseRepresentantFilters,
  serializeRepresentantFilters,
  type RepresentantFilters,
} from '@/lib/representant-filters';

const ADAPTER: UrlFilterAdapter<RepresentantFilters> = {
  parse: parseRepresentantFilters,
  serialize: serializeRepresentantFilters,
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
