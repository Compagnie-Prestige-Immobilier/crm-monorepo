'use client';

import { useUrlFilters, type UrlFilterAdapter } from '@/components/filters/use-url-filters';
import {
  EMPTY_USER_FILTERS,
  parseUserFilters,
  serializeUserFilters,
  type UserFilters,
} from '@/lib/user-filters';

const ADAPTER: UrlFilterAdapter<UserFilters> = {
  parse: parseUserFilters,
  serialize: serializeUserFilters,
  cleared: (current) => ({ ...EMPTY_USER_FILTERS, pageSize: current.pageSize }),
};

export function useUserFilters(): {
  filters: UserFilters;
  setFilters: (patch: Partial<UserFilters>) => void;
  resetFilters: () => void;
} {
  return useUrlFilters(ADAPTER);
}
