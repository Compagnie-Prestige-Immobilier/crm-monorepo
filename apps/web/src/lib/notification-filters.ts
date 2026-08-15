import { readEnum, readPositiveInt, readString, type RawSearchParams } from '@/lib/search-params';
import type { NotificationCategory, NotificationStatus } from '@/components/notifications/types';

/**
 * Filtre de l'écran Notifications : traduction URL ⇄ objet.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Ce que ce module répare.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'historique des envois était figé sur `{ page: 1, pageSize: 20 }`, une
 * constante de module sans aucun contrôle à l'écran : ni pagination, ni filtre.
 * La vingt-et-unième notification jamais envoyée devenait donc INATTEIGNABLE,
 * alors que l'API exposait `page`, `status` et `category` depuis le début. Sur
 * un produit qui envoie des annonces et des rappels quotidiens, cela survient
 * dans le mois qui suit la mise en service.
 *
 * L'ONGLET vit dans l'URL, lui aussi. Il vivait dans un `useState` : recharger
 * la page renvoyait sur l'historique, et « regarde l'onglet Gabarits » n'était
 * pas un lien qu'on colle. Les campagnes utilisent une route par onglet, les
 * statistiques un paramètre d'URL ; ici le paramètre suffit, puisque les trois
 * onglets ne portent pas trois jeux de critères concurrents.
 *
 * Analyse TOLÉRANTE, comme les six autres écrans filtrables : une valeur
 * inconnue est écartée, jamais propagée vers l'API.
 */

export const NOTIFICATION_PAGE_SIZE = 20;

/**
 * Les trois onglets, et à qui ils s'adressent.
 *
 * `reception` est la BOÎTE DE RÉCEPTION, ouverte à tous les rôles : c'est
 * l'écran complet que la cloche promettait sans jamais y mener. `historique` et
 * `gabarits` sont l'émission, réservée à l'ADMIN.
 */
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
  'CAMPAGNE',
  'DOSSIER',
  'SYSTEME',
] as const satisfies readonly NotificationCategory[];

export interface NotificationFiltersState {
  tab: NotificationTab;
  status: NotificationStatus | null;
  category: NotificationCategory | null;
  /** Page de l'historique d'envoi. */
  page: number;
  /** Page de la boîte de réception, indépendante de la précédente. */
  inboxPage: number;
  /** Boîte de réception : ne montrer que les non lues. */
  unreadOnly: boolean;
}

/**
 * Onglet d'atterrissage, selon le rôle.
 *
 * Un ADMIN qui ouvre « Notifications » depuis son menu vient émettre : il
 * atterrit sur l'historique. Tout autre rôle n'a que sa boîte de réception, et
 * c'est aussi là que mène le lien « Tout voir » de la cloche.
 */
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

/**
 * Un onglet réservé, demandé par un rôle qui n'y a pas droit, retombe sur le
 * sien : `?onglet=gabarits` collé à un agent bancaire ne doit pas produire un
 * écran vide sans explication, ni six requêtes qui finiront en 403.
 */
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

/** Sérialisation canonique : défauts omis, ordre de clés fixe, donc clé de cache. */
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

/** Ce qui compte comme « filtre actif » sur l'historique d'envoi. */
export function countActiveNotificationFilters(filters: NotificationFiltersState): number {
  let count = 0;
  if (filters.status !== null) count += 1;
  if (filters.category !== null) count += 1;
  return count;
}
