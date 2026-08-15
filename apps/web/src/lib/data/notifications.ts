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

/**
 * Composition des notifications : envoi, annulation, gabarits, public visé.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Ce module remplace un `fetch` manuel qui castait en `as T`, sans rien valider.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `components/notifications/api.ts` avait été écrit AVANT la régénération du
 * contrat, sur la promesse d'être remplacé ensuite. Les neuf routes figurent
 * maintenant dans `packages/api-client/src/generated`, et la dette avait tourné
 * au piège : un `as T` fait entrer dans l'écran une valeur dont personne n'a
 * vérifié la forme, et le compilateur la croit sur parole. Le champ
 * `reachableCount`, retiré du contrat, est resté « présent » pour le composeur
 * jusqu'à ce que le typage engendré le contredise.
 *
 * Le chemin est inchangé : `getApiClient()` frappe le relais `/api/v1/*` de
 * Next, qui attache le jeton depuis le cookie `httpOnly`. Aucun JWT n'atteint le
 * JavaScript de la page, ici pas plus qu'ailleurs.
 */

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
  /*
    `exactOptionalPropertyTypes` : écrire `status: undefined` n'est pas la même
    chose que ne pas l'écrire. `openapi-fetch` sérialiserait la clé, et l'API
    refuserait un `status=undefined` littéral.
  */
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

/**
 * Nombre de destinataires du public visé, calculé par le SERVEUR.
 *
 * C'est ce chiffre qui rend l'étape de confirmation utile : « Confirmer
 * l'envoi ? » sans destinataires ne protège de rien. Il est donc demandé avec
 * exactement les critères de l'envoi, et jamais estimé côté panel.
 */
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

// ─── Gabarits ────────────────────────────────────────────────────────────────

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

// ─── Référentiel du sélecteur de public ──────────────────────────────────────

/**
 * Les départements viennent de `lib/data/reference.ts`, comme partout ailleurs.
 *
 * Le module supprimé en redéclarait une version locale, avec son propre type
 * `DepartementOption` : deux appels vers la même route, deux formes déclarées,
 * et deux entrées de cache pour une liste qui change une fois par an.
 */
export { fetchDepartements };

/**
 * Clés de cache de la COMPOSITION, distinctes de celles de la boîte de
 * réception (`queryKeys.inbox*`) : deux publics, deux caches. Un admin qui
 * compose une annonce ne doit pas voir sa propre cloche se recharger, et
 * marquer une ligne lue ne doit pas invalider l'historique d'envoi.
 */
export const notificationKeys = {
  root: ['notifications'] as const,
  list: (filters: NotificationFilters) => ['notifications', 'list', filters] as const,
  detail: (id: string) => ['notifications', 'detail', id] as const,
  preview: (query: AudienceQuery) => ['notifications', 'preview', query] as const,
  templates: ['notifications', 'templates'] as const,
  departements: ['notifications', 'departements'] as const,
};
