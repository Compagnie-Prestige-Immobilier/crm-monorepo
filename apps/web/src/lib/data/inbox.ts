import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';

type Schemas = components['schemas'];

export type InboxItem = Schemas['InboxItemDto'];
export type Inbox = Schemas['InboxDto'];

export const INBOX_PAGE_SIZE = 20;

export async function fetchInbox(client: ApiClient = getApiClient()): Promise<Inbox> {
  return unwrap(
    await client.GET('/api/v1/notifications/mine', {
      params: { query: { pageSize: INBOX_PAGE_SIZE } },
    }),
  );
}

export const INBOX_SCREEN_PAGE_SIZE = 25;

export interface InboxPageFilters {
  page: number;
  unreadOnly: boolean;
}

export const EMPTY_INBOX_FILTERS: InboxPageFilters = { page: 1, unreadOnly: false };

export async function fetchInboxPage(
  filters: InboxPageFilters,
  client: ApiClient = getApiClient(),
): Promise<Inbox> {
  const query = filters.unreadOnly
    ? { page: filters.page, pageSize: INBOX_SCREEN_PAGE_SIZE, unreadOnly: true }
    : { page: filters.page, pageSize: INBOX_SCREEN_PAGE_SIZE };

  return unwrap(await client.GET('/api/v1/notifications/mine', { params: { query } }));
}

export async function markNotificationRead(
  notificationId: string,
  client: ApiClient = getApiClient(),
): Promise<void> {
  unwrap(
    await client.POST('/api/v1/notifications/{id}/read', {
      params: { path: { id: notificationId } },
    }),
  );
}

export const MARK_ALL_PAGE_SIZE = 50;
export const MARK_ALL_MAX_PAGES = 6;

export async function markAllNotificationsRead(
  client: ApiClient = getApiClient(),
): Promise<number> {
  let marked = 0;

  for (let round = 0; round < MARK_ALL_MAX_PAGES; round += 1) {
    const page = unwrap(
      await client.GET('/api/v1/notifications/mine', {
        params: { query: { page: 1, pageSize: MARK_ALL_PAGE_SIZE, unreadOnly: true } },
      }),
    );
    if (page.items.length === 0) return marked;

    for (const item of page.items) {
      await markNotificationRead(item.notificationId, client);
      marked += 1;
    }
  }

  return marked;
}

/**
 * Les DEUX formes, et il faut les deux.
 *
 * Les notifications déjà en base portent les adresses d'avant le découpage en
 * coques ; les nouvelles portent les adresses canoniques. Retirer les anciennes
 * ferait taire les liens de tout ce qui a été envoyé jusqu'ici, et n'accepter
 * que les anciennes ferait taire ceux d'après.
 */
const WEB_ROUTES: readonly string[] = [
  '/tableau-de-bord',
  '/statistiques',
  '/prospects',
  '/campagnes',
  '/dossiers',
  '/demandes-clients',
  '/representants',
  '/commerciaux',
  '/supervision',
  '/referentiels',
  '/notifications',
  '/parametres',
  '/banque',

  '/chues/tableau-de-bord',
  '/chues/statistiques',
  '/chues/prospects',
  '/chues/campagnes',
  '/chues/dossiers',
  '/chues/demandes-clients',
  '/chues/representants',
  '/chues/supervision',
  '/chues/banque',
  '/admin/commerciaux',
  '/admin/referentiels',
  '/admin/notifications',
  '/admin/parametres',
  '/accueil',
  '/grand-public',
  '/espaces',
];

export function webRouteFor(route: string | null): string | null {
  if (route === null) return null;
  if (!route.startsWith('/') || route.startsWith('//')) return null;
  const path = route.split('?')[0] ?? route;
  const matches = WEB_ROUTES.some((known) => path === known || path.startsWith(`${known}/`));
  return matches ? route : null;
}

export const UNREAD_BADGE_MAX = 99;

export function unreadBadgeLabel(unreadCount: number): string {
  if (unreadCount <= 0) return '';
  return unreadCount > UNREAD_BADGE_MAX ? `${String(UNREAD_BADGE_MAX)}+` : String(unreadCount);
}

export function bellLabel(unreadCount: number): string {
  if (unreadCount <= 0) return 'Notifications, aucune non lue';
  return `Notifications, ${String(unreadCount)} non lue${unreadCount > 1 ? 's' : ''}`;
}

export function hasNewArrival(
  previous: { topId: string | null; unreadCount: number } | null,
  next: { topId: string | null; unreadCount: number },
): boolean {
  if (previous === null) return false;
  if (next.unreadCount <= 0) return false;
  if (next.topId !== previous.topId) return true;
  return next.unreadCount > previous.unreadCount;
}

export function inboxSignature(inbox: Inbox | undefined): {
  topId: string | null;
  unreadCount: number;
} {
  if (inbox === undefined) return { topId: null, unreadCount: 0 };
  return { topId: inbox.items[0]?.id ?? null, unreadCount: inbox.unreadCount };
}
