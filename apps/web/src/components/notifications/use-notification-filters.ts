'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import {
  parseNotificationFilters,
  serializeNotificationFilters,
  type NotificationFiltersState,
} from '@/lib/notification-filters';

/**
 * L'état de l'écran Notifications, porté par l'URL.
 *
 * Il ne passe PAS par `useUrlFilters` : l'analyse et la sérialisation dépendent
 * du rôle (un onglet d'émission demandé par un agent bancaire retombe sur sa
 * boîte de réception), et l'adaptateur générique attend des fonctions de module
 * sans paramètre supplémentaire. Le mécanisme reste le même : `replace` et non
 * `push`, pour qu'un changement d'onglet ne remplisse pas l'historique.
 */
export function useNotificationFilters(isAdmin: boolean): {
  filters: NotificationFiltersState;
  setFilters: (patch: Partial<NotificationFiltersState>) => void;
} {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () => parseNotificationFilters(new URLSearchParams(searchParams.toString()), isAdmin),
    [searchParams, isAdmin],
  );

  const setFilters = useCallback(
    (patch: Partial<NotificationFiltersState>) => {
      const next = { ...filters, ...patch };

      /**
       * Changer un CRITÈRE remet la pagination à 1.
       *
       * Rester en page 7 d'un résultat qui n'en compte plus que 2 affiche une
       * liste vide, et cela se lit comme une panne. Même règle que
       * `use-url-filters.ts`, appliquée aux seules clés qui restreignent la
       * population : l'onglet et les deux paginations en sont évidemment
       * exclus.
       */
      const narrowing = ['status', 'category'].some((key) => key in patch);
      if (narrowing) next.page = 1;
      if ('unreadOnly' in patch) next.inboxPage = 1;

      const query = serializeNotificationFilters(next, isAdmin).toString();
      router.replace(query === '' ? pathname : `${pathname}?${query}`, { scroll: false });
    },
    [filters, isAdmin, pathname, router],
  );

  return { filters, setFilters };
}
