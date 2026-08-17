'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import { isTransientPatch } from '@/components/filters/use-url-filters';
import { EMPTY_FILTERS, parseProspectFilters, serializeProspectFilters } from '@/lib/filters';
import type { ProspectFilters } from '@/lib/types';

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

      const onlyPagination =
        Object.keys(patch).length > 0 &&
        Object.keys(patch).every((key) => key === 'page' || key === 'pageSize');
      if (!onlyPagination) next.page = 1;

      const query = serializeProspectFilters(next).toString();
      const url = query === '' ? pathname : `${pathname}?${query}`;
      if (isTransientPatch(patch)) {
        router.replace(url, { scroll: false });
      } else {
        router.push(url, { scroll: false });
      }
    },
    [filters, pathname, router],
  );

  const resetFilters = useCallback(() => {
    const query = serializeProspectFilters({
      ...EMPTY_FILTERS,
      pageSize: filters.pageSize,
    }).toString();
    router.push(query === '' ? pathname : `${pathname}?${query}`, { scroll: false });
  }, [filters.pageSize, pathname, router]);

  return { filters, setFilters, resetFilters };
}
