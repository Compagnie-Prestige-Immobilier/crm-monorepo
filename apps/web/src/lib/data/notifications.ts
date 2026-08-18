import type { ApiClient } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import type { AudienceQuery } from '@/components/notifications/audience';
import type {
  AudiencePreview,
  CreateNotificationInput,
  CreateTemplateInput,
  NotificationCategory,
  NotificationDetail,
  NotificationList,
  NotificationRow,
  NotificationStatus,
  NotificationTemplate,
  UpdateTemplateInput,
} from '@/components/notifications/types';
import { getApiClient } from '@/lib/api/browser';
import { fetchDepartements } from '@/lib/data/reference';

export interface NotificationFilters {
  page: number;
  pageSize: number;
  status?: NotificationStatus | undefined;
  category?: NotificationCategory | undefined;
}

export async function fetchNotifications(
  filters: NotificationFilters,
  client: ApiClient = getApiClient(),
): Promise<NotificationList> {
  const query = {
    page: filters.page,
    pageSize: filters.pageSize,
    ...(filters.status === undefined ? {} : { status: filters.status }),
    ...(filters.category === undefined ? {} : { category: filters.category }),
  };

  return unwrap(await client.GET('/api/v1/notifications', { params: { query } }));
}

export async function fetchNotification(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<NotificationDetail> {
  return unwrap(await client.GET('/api/v1/notifications/{id}', { params: { path: { id } } }));
}

export async function fetchAudiencePreview(
  query: AudienceQuery,
  client: ApiClient = getApiClient(),
): Promise<AudiencePreview> {
  return unwrap(await client.GET('/api/v1/notifications/audience-preview', { params: { query } }));
}

export async function createNotification(
  input: CreateNotificationInput,
  client: ApiClient = getApiClient(),
): Promise<NotificationRow> {
  return unwrap(await client.POST('/api/v1/notifications', { body: input }));
}

export async function cancelNotification(
  id: string,
  client: ApiClient = getApiClient(),
): Promise<NotificationRow> {
  return unwrap(
    await client.POST('/api/v1/notifications/{id}/cancel', { params: { path: { id } } }),
  );
}

export async function fetchTemplates(
  includeInactive = false,
  client: ApiClient = getApiClient(),
): Promise<{ items: NotificationTemplate[] }> {
  const query = includeInactive ? { includeInactive: true } : {};
  return unwrap(await client.GET('/api/v1/notification-templates', { params: { query } }));
}

export async function createTemplate(
  input: CreateTemplateInput,
  client: ApiClient = getApiClient(),
): Promise<NotificationTemplate> {
  return unwrap(await client.POST('/api/v1/notification-templates', { body: input }));
}

export async function updateTemplate(
  id: string,
  input: UpdateTemplateInput,
  client: ApiClient = getApiClient(),
): Promise<NotificationTemplate> {
  return unwrap(
    await client.PATCH('/api/v1/notification-templates/{id}', {
      params: { path: { id } },
      body: input,
    }),
  );
}

export { fetchDepartements };

export const notificationKeys = {
  root: ['notifications'] as const,
  list: (filters: NotificationFilters) => ['notifications', 'list', filters] as const,
  detail: (id: string) => ['notifications', 'detail', id] as const,
  preview: (query: AudienceQuery) => ['notifications', 'preview', query] as const,
  templates: ['notifications', 'templates'] as const,
  departements: ['notifications', 'departements'] as const,
};
