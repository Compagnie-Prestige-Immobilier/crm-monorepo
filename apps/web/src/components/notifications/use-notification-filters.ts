'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

import {
  parseNotificationFilters,
  serializeNotificationFilters,
  type NotificationFiltersState,
} from '@/lib/notification-filters';

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
