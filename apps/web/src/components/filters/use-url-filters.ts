'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

export interface UrlFilterAdapter<T> {
  parse: (params: URLSearchParams) => T;
  serialize: (filters: T) => URLSearchParams;
  cleared: (current: T) => T;
}

const TRANSIENT_KEYS: readonly string[] = ['search'];

export function isTransientPatch(patch: object): boolean {
  const keys = Object.keys(patch);
  if (keys.length === 0) return true;
  return keys.every((key) => TRANSIENT_KEYS.includes(key));
}

function withPageReset<T>(next: T, patch: Partial<T>): T {
  const keys = Object.keys(patch);
  if (keys.length === 0) return next;
  if (keys.every((key) => key === 'page' || key === 'pageSize')) return next;
  if (!(typeof next === 'object' && next !== null && 'page' in next)) return next;
  return { ...next, page: 1 };
}

export function useUrlFilters<T>(adapter: UrlFilterAdapter<T>): {
  filters: T;
  setFilters: (patch: Partial<T>) => void;
  resetFilters: () => void;
} {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => adapter.parse(new URLSearchParams(searchParams.toString())),
    [adapter, searchParams],
  );

  // Un filtre ne change rien côté serveur : l'historique natif suffit et, hors
  // ligne, évite le rechargement complet que le routeur tente quand son fetch échoue.
  const navigate = useCallback(
    (next: T, transient: boolean) => {
      const query = adapter.serialize(next).toString();
      const url = query === '' ? pathname : `${pathname}?${query}`;
      if (transient) {
        window.history.replaceState(null, '', url);
      } else {
        window.history.pushState(null, '', url);
      }
    },
    [adapter, pathname],
  );

  const setFilters = useCallback(
    (patch: Partial<T>) => {
      navigate(withPageReset({ ...filters, ...patch }, patch), isTransientPatch(patch));
    },
    [filters, navigate],
  );

  const resetFilters = useCallback(() => {
    navigate(adapter.cleared(filters), false);
  }, [adapter, filters, navigate]);

  return { filters, setFilters, resetFilters };
}
