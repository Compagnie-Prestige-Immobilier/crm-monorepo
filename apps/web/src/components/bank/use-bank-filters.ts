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

/**
 * Source unique de l'état de filtre de Banque & Finance : l'URL.
 *
 * Trois consommateurs lisent ce même objet : la liste, le tableau de bord et
 * l'export. Les tenir dans un état React local obligerait à les synchroniser à
 * trois, et il suffirait d'un oubli pour qu'un classeur ne corresponde plus à
 * l'écran depuis lequel il a été demandé.
 *
 * Bénéfice secondaire, mais celui que l'agent voit : « les dossiers rejetés de
 * mars pour motif document manquant » est une URL. Elle se colle dans un
 * message, se met en favori, et le bouton « Précédent » défait le dernier
 * filtre.
 *
 * Cette dernière promesse tient depuis que `setFilters` EMPILE une entrée sur un
 * critère choisi, au lieu de tout remplacer. Le raisonnement complet, et la
 * raison pour laquelle la recherche libre fait exception, sont dans
 * `components/filters/use-url-filters.ts`.
 */
export function useBankFilters(): {
  filters: BankCaseFilters;
  setFilters: (patch: Partial<BankCaseFilters>) => void;
  resetFilters: () => void;
  /** Chemin + requête, pour un `<Link>` qui applique un filtre. */
  hrefWith: (patch: Partial<BankCaseFilters>, pathname?: string) => string;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => parseBankFilters(new URLSearchParams(searchParams.toString())),
    [searchParams],
  );

  const buildHref = useCallback(
    (patch: Partial<BankCaseFilters>, target?: string): string => {
      const next: BankCaseFilters = { ...filters, ...patch };

      // Changer un critère remet la pagination à 1 : rester en page 7 d'un
      // résultat qui n'en compte plus que 2 affiche une liste vide et se lit
      // comme un bug.
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
    // La taille de page est une préférence d'affichage, pas un filtre : on la
    // conserve en effaçant les critères.
    const query = serializeBankFilters({
      ...EMPTY_BANK_FILTERS,
      pageSize: filters.pageSize,
    }).toString();
    // Geste délibéré, et l'un des plus regrettés : il doit pouvoir se défaire.
    router.push(query === '' ? pathname : `${pathname}?${query}`, { scroll: false });
  }, [filters.pageSize, pathname, router]);

  return { filters, setFilters, resetFilters, hrefWith: buildHref };
}
