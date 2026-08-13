import { ApiError } from '@crm/api-client/query';

import type {
  AudiencePreview,
  CreateNotificationInput,
  CreateTemplateInput,
  NotificationDetail,
  NotificationList,
  NotificationRow,
  NotificationTemplate,
  UpdateTemplateInput,
} from './types';

/**
 * Accès HTTP de la fonctionnalité.
 *
 * Passe par le RELAIS de Next (`/api/v1/[...path]`), comme tout le panel : le
 * relais attache le jeton depuis le cookie httpOnly et le renouvelle au besoin.
 * Aucun jeton n'atteint donc JavaScript, ici pas plus qu'ailleurs.
 *
 * `fetch` direct plutôt que le client généré, parce que ces routes ne figurent
 * pas encore dans `packages/api-client/src/generated`. Les erreurs sont
 * néanmoins converties en `ApiError`, de sorte que `apiErrorText` et
 * `QueryErrorState` fonctionnent exactement comme sur les autres écrans — un
 * 403 doit s'afficher comme un refus de droits, pas comme une panne.
 *
 * TODO(generated-client) : remplacer par `client.GET('/api/v1/notifications')`
 * une fois le contrat régénéré.
 */

const BASE = '/api/v1';

const origin = (): string => (typeof window === 'undefined' ? '' : window.location.origin);

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  // `Headers` plutôt qu'un littéral fusionné : `HeadersInit` accepte aussi un
  // tableau de paires, qu'un étalement d'objet transformerait en indices.
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  if (init?.body !== undefined) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${origin()}${BASE}${path}`, { ...init, headers });

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new ApiError(body, response);
  }

  // 204 n'a pas de corps ; le parser lèverait sur une chaîne vide.
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const search = (params: Record<string, string | number | boolean | undefined>): string => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    query.set(key, String(value));
  }
  const rendered = query.toString();
  return rendered === '' ? '' : `?${rendered}`;
};

// ─────────────────────────────────────────────────────────────────────────────

export interface NotificationFilters {
  page: number;
  pageSize: number;
  status?: string | undefined;
  category?: string | undefined;
}

export const DEFAULT_NOTIFICATION_FILTERS: NotificationFilters = { page: 1, pageSize: 20 };

export function fetchNotifications(filters: NotificationFilters): Promise<NotificationList> {
  return request<NotificationList>(
    `/notifications${search({
      page: filters.page,
      pageSize: filters.pageSize,
      status: filters.status,
      category: filters.category,
    })}`,
  );
}

export function fetchNotification(id: string): Promise<NotificationDetail> {
  return request<NotificationDetail>(`/notifications/${encodeURIComponent(id)}`);
}

export function fetchAudiencePreview(query: Record<string, string>): Promise<AudiencePreview> {
  return request<AudiencePreview>(`/notifications/audience-preview${search(query)}`);
}

export function createNotification(input: CreateNotificationInput): Promise<NotificationRow> {
  return request<NotificationRow>('/notifications', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function cancelNotification(id: string): Promise<NotificationRow> {
  return request<NotificationRow>(`/notifications/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
  });
}

// ─────────────────────────────────────────────────────────────────────────────

export function fetchTemplates(
  includeInactive = false,
): Promise<{ items: NotificationTemplate[] }> {
  return request<{ items: NotificationTemplate[] }>(
    `/notification-templates${search({ includeInactive: includeInactive ? true : undefined })}`,
  );
}

export function createTemplate(input: CreateTemplateInput): Promise<NotificationTemplate> {
  return request<NotificationTemplate>('/notification-templates', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTemplate(
  id: string,
  input: UpdateTemplateInput,
): Promise<NotificationTemplate> {
  return request<NotificationTemplate>(`/notification-templates/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

// ─────────────────────────────────────────────────────────────────────────────

/** Départements, pour le sélecteur de public. Route existante du panel. */
export interface DepartementOption {
  id: string;
  name: string;
}

export function fetchDepartements(): Promise<DepartementOption[]> {
  return request<{ items: DepartementOption[] }>('/referentiels/departements').then(
    (payload) => payload.items,
  );
}

export const notificationKeys = {
  root: ['notifications'] as const,
  list: (filters: NotificationFilters) => ['notifications', 'list', filters] as const,
  detail: (id: string) => ['notifications', 'detail', id] as const,
  preview: (query: Record<string, string>) => ['notifications', 'preview', query] as const,
  templates: ['notifications', 'templates'] as const,
  departements: ['notifications', 'departements'] as const,
};
