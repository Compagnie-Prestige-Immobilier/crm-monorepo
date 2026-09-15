'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import { isTransientPatch } from '@/components/filters/use-url-filters';

import {
  EMPTY_BANK_FILTERS,
  parseBankFilters,
  serializeBankFilters,
  type BankCaseFilters,
} from '@/lib/bank-filters';
import type { Projet } from '@/lib/types';

/** `projet` vient de la page ou de l'URL si omis. */
export function useBankFilters(explicitProjet?: Projet | null): {
  filters: BankCaseFilters;
  setFilters: (patch: Partial<BankCaseFilters>) => void;
  resetFilters: () => void;
  hrefWith: (patch: Partial<BankCaseFilters>, pathname?: string) => string;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(() => {
    const parsed = parseBankFilters(new URLSearchParams(searchParams.toString()));
    const projet = explicitProjet !== undefined ? explicitProjet : parsed.projet;
    return { ...parsed, projet };
  }, [searchParams, explicitProjet]);

  const buildHref = useCallback(
    (patch: Partial<BankCaseFilters>, target?: string): string => {
      const next: BankCaseFilters = { ...filters, ...patch };

      const onlyPagination =
        Object.keys(patch).length > 0 &&
        Object.keys(patch).every((key) => key === 'page' || key === 'pageSize');
      if (!onlyPagination) next.page = 1;

      const base = target ?? pathname;
      const query = serializeBankFilters(next).toString();
      return query === '' ? base : `${base}?${query}`;
    },
    [filters, pathname],
  );

  const setFilters = useCallback(
    (patch: Partial<BankCaseFilters>) => {
      const url = buildHref(patch);
      if (isTransientPatch(patch)) {
        router.replace(url, { scroll: false });
      } else {
        router.push(url, { scroll: false });
      }
    },
    [buildHref, router],
  );

  const resetFilters = useCallback(() => {
    const query = serializeBankFilters({
      ...EMPTY_BANK_FILTERS,
      pageSize: filters.pageSize,
    }).toString();
    router.push(query === '' ? pathname : `${pathname}?${query}`, { scroll: false });
  }, [filters.pageSize, pathname, router]);

  return { filters, setFilters, resetFilters, hrefWith: buildHref };
}
