import { readEnum, readPositiveInt, readString, type RawSearchParams } from '@/lib/search-params';
import type { NotificationCategory, NotificationStatus } from '@/components/notifications/types';

export const NOTIFICATION_PAGE_SIZE = 20;

export const NOTIFICATION_TABS = ['reception', 'historique', 'gabarits'] as const;

export type NotificationTab = (typeof NOTIFICATION_TABS)[number];

export const NOTIFICATION_STATUSES = [
  'SCHEDULED',
  'SENDING',
  'SENT',
  'CANCELLED',
] as const satisfies readonly NotificationStatus[];

export const NOTIFICATION_CATEGORIES = [
  'ANNONCE',
  'RAPPEL',
  'DOSSIER',
  'SYSTEME',
] as const satisfies readonly NotificationCategory[];

export interface NotificationFiltersState {
  tab: NotificationTab;
  status: NotificationStatus | null;
  category: NotificationCategory | null;
  page: number;
  inboxPage: number;
  unreadOnly: boolean;
}

export function defaultNotificationTab(isAdmin: boolean): NotificationTab {
  return isAdmin ? 'historique' : 'reception';
}

export function emptyNotificationFilters(isAdmin: boolean): NotificationFiltersState {
  return {
    tab: defaultNotificationTab(isAdmin),
    status: null,
    category: null,
    page: 1,
    inboxPage: 1,
    unreadOnly: false,
  };
}

export function parseNotificationFilters(
  params: RawSearchParams | URLSearchParams,
  isAdmin: boolean,
): NotificationFiltersState {
  const requested = readEnum<NotificationTab>(params, 'onglet', NOTIFICATION_TABS);
  const tab =
    requested === null || (!isAdmin && requested !== 'reception')
      ? defaultNotificationTab(isAdmin)
      : requested;

  return {
    tab,
    status: readEnum<NotificationStatus>(params, 'statut', NOTIFICATION_STATUSES),
    category: readEnum<NotificationCategory>(params, 'categorie', NOTIFICATION_CATEGORIES),
    page: readPositiveInt(params, 'page', 1),
    inboxPage: readPositiveInt(params, 'pageRecue', 1),
    unreadOnly: readString(params, 'nonLues') === 'oui',
  };
}

export function serializeNotificationFilters(
  filters: NotificationFiltersState,
  isAdmin: boolean,
): URLSearchParams {
  const params = new URLSearchParams();

  if (filters.tab !== defaultNotificationTab(isAdmin)) params.set('onglet', filters.tab);
  if (filters.status !== null) params.set('statut', filters.status);
  if (filters.category !== null) params.set('categorie', filters.category);
  if (filters.page !== 1) params.set('page', String(filters.page));
  if (filters.inboxPage !== 1) params.set('pageRecue', String(filters.inboxPage));
  if (filters.unreadOnly) params.set('nonLues', 'oui');

  return params;
}

export function countActiveNotificationFilters(filters: NotificationFiltersState): number {
  let count = 0;
  if (filters.status !== null) count += 1;
  if (filters.category !== null) count += 1;
  return count;
}
