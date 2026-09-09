import { apiClient, ApiError } from '@/api/client';
import type { components } from '@/api/schema';
import { ROLE_LABELS, type Role } from '@/lib/types';

type Schemas = components['schemas'];

export type NotificationCategory = Schemas['Notification']['category'];
export type NotificationStatus = Schemas['Notification']['status'];
export type NotificationRow = Schemas['Notification'];
export type NotificationRecue = Schemas['NotificationRecue'];
export type NotificationInbox = Schemas['NotificationBoiteOutputBody'];
export type NotificationDetail = Schemas['DetailNotificationOutputBody'];
export type NotificationDestinataire = Schemas['NotificationDestinataire'];

/** Audiences proposées à la composition : le serveur refuse `DEPARTEMENT` (comptes sans département). */
export type SendableAudience = 'ALL' | 'ROLE' | 'USERS';

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  ANNONCE: 'Annonce',
  RAPPEL: 'Rappel',
  CAMPAGNE: 'Campagne',
  DOSSIER: 'Dossier',
  SYSTEME: 'Système',
};

export const STATUS_LABELS: Record<NotificationStatus, string> = {
  SCHEDULED: 'Programmée',
  SENDING: 'En cours',
  SENT: 'Envoyée',
  CANCELLED: 'Annulée',
};

export const DELIVERY_LABELS: Record<NotificationDestinataire['status'], string> = {
  PENDING: 'En attente',
  SENT: 'Remise',
  DELIVERED: 'Reçue',
  FAILED: 'Échec',
  READ: 'Lue',
};

const INBOX_PAGE_SIZE = 25;

export async function fetchInboxPage(
  filters: { page: number; unreadOnly: boolean },
  pageSize = INBOX_PAGE_SIZE,
): Promise<NotificationInbox> {
  const query = filters.unreadOnly
    ? { page: filters.page, pageSize, unreadOnly: true }
    : { page: filters.page, pageSize };
  const { data, error, response } = await apiClient.GET('/api/v1/notifications/mine', {
    params: { query },
  });
  if (error) {
    throw new ApiError(response.status, error, 'La boîte de réception n’a pas pu être chargée.');
  }
  return data;
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { error, response } = await apiClient.POST('/api/v1/notifications/{id}/read', {
    params: { path: { id: notificationId } },
  });
  if (error) throw new ApiError(response.status, error, 'Le marquage a échoué.');
}

export interface NotificationFilters {
  page: number;
  pageSize: number;
  status?: NotificationStatus | undefined;
  category?: NotificationCategory | undefined;
}

export async function fetchNotifications(
  filters: NotificationFilters,
): Promise<Schemas['ListerNotificationsOutputBody']> {
  const query = {
    page: filters.page,
    pageSize: filters.pageSize,
    ...(filters.status === undefined ? {} : { status: filters.status }),
    ...(filters.category === undefined ? {} : { category: filters.category }),
  };
  const { data, error, response } = await apiClient.GET('/api/v1/notifications', {
    params: { query },
  });
  if (error) {
    throw new ApiError(
      response.status,
      error,
      'L’historique des notifications n’a pas pu être chargé.',
    );
  }
  return data;
}

export async function fetchNotification(id: string): Promise<NotificationDetail> {
  const { data, error, response } = await apiClient.GET('/api/v1/notifications/{id}', {
    params: { path: { id } },
  });
  if (error) throw new ApiError(response.status, error, 'Le détail n’a pas pu être chargé.');
  return data;
}

export interface AudienceQuery {
  audience: SendableAudience;
  audienceRole?: Role;
  audienceUserIds?: string;
}

export async function fetchAudiencePreview(
  query: AudienceQuery,
): Promise<Schemas['NotificationApercuOutputBody']> {
  const { data, error, response } = await apiClient.GET('/api/v1/notifications/audience-preview', {
    params: { query },
  });
  if (error) {
    throw new ApiError(response.status, error, 'L’aperçu du public n’a pas pu être calculé.');
  }
  return data;
}

export interface CreateNotificationInput {
  title: string;
  body: string;
  category: NotificationCategory;
  route?: string;
  audience: SendableAudience;
  audienceRole?: Role;
  audienceUserIds?: string[];
  scheduledFor?: string;
}

export async function createNotification(input: CreateNotificationInput): Promise<NotificationRow> {
  const { data, error, response } = await apiClient.POST('/api/v1/notifications', { body: input });
  if (error) throw new ApiError(response.status, error, 'L’envoi n’a pas pu être créé.');
  return data;
}

export async function cancelNotification(id: string): Promise<NotificationRow> {
  const { data, error, response } = await apiClient.POST('/api/v1/notifications/{id}/cancel', {
    params: { path: { id } },
  });
  if (error) throw new ApiError(response.status, error, 'L’annulation a échoué.');
  return data;
}

export const notificationKeys = {
  root: ['notifications-admin'] as const,
  list: (filters: NotificationFilters) => ['notifications-admin', 'list', filters] as const,
  detail: (id: string) => ['notifications-admin', 'detail', id] as const,
  preview: (query: AudienceQuery) => ['notifications-admin', 'preview', query] as const,
};

export function describeAudience(
  row: Pick<NotificationRow, 'audience' | 'audienceRole' | 'audienceUserIds'>,
): string {
  if (row.audience === 'ROLE') {
    return row.audienceRole === null ? 'Par rôle' : ROLE_LABELS[row.audienceRole as Role];
  }
  if (row.audience === 'USERS') {
    const count = row.audienceUserIds?.length ?? 0;
    return count === 1 ? '1 compte choisi' : `${String(count)} comptes choisis`;
  }
  if (row.audience === 'DEPARTEMENT') return 'Par département';
  return 'Tout le monde';
}

export function confirmationSentence(recipientCount: number): string {
  if (recipientCount === 0) {
    return 'Ce public ne correspond à aucun compte actif. Rien ne sera envoyé.';
  }
  const personnes = recipientCount === 1 ? '1 personne' : `${String(recipientCount)} personnes`;
  return `Cet envoi s’adresse à ${personnes}.`;
}
