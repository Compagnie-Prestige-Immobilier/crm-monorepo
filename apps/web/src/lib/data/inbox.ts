import type { ApiClient, components } from '@crm/api-client';
import { unwrap } from '@crm/api-client/query';

import { getApiClient } from '@/lib/api/browser';

/**
 * Boîte de réception de l'utilisateur courant : `GET /notifications/mine`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Cette route existait depuis le début et n'avait AUCUN appelant côté web.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le back-end sait notifier (audiences, rappels planifiés, transports), l'écran
 * `/notifications` sait composer : personne n'écoutait. Une demande de création
 * de client déposée par une banque partait donc dans une file que l'admin ne
 * voyait qu'en tapant une URL. La cloche de la barre supérieure est le
 * consommateur manquant.
 *
 * Tout passe par le client engendré : ces routes figurent maintenant dans
 * `openapi.json`, il n'y a plus de raison d'emprunter le `fetch` manuel de
 * `components/notifications/api.ts` (écrit avant la régénération du contrat).
 */

type Schemas = components['schemas'];

export type InboxItem = Schemas['InboxItemDto'];
export type Inbox = Schemas['InboxDto'];

/**
 * Une seule page, la plus récente.
 *
 * Le panneau n'est pas un historique : il montre ce qui vient d'arriver et
 * renvoie vers l'écran complet au-delà. Vingt lignes couvrent largement une
 * journée de rappels, et une pagination dans un menu déroulant serait une
 * navigation dans une navigation.
 */
export const INBOX_PAGE_SIZE = 20;

export async function fetchInbox(client: ApiClient = getApiClient()): Promise<Inbox> {
  return unwrap(
    await client.GET('/api/v1/notifications/mine', {
      params: { query: { pageSize: INBOX_PAGE_SIZE } },
    }),
  );
}

// ─── Écran complet ───────────────────────────────────────────────────────────

/**
 * L'ÉCRAN de boîte de réception, distinct du panneau de la cloche.
 *
 * La cloche montre les vingt dernières et renvoie ici : c'est ce que promettait
 * son commentaire, mais le lien n'existait pas et `/notifications` était le
 * COMPOSEUR, réservé à l'ADMIN. Une notification tombée en vingt-et-unième
 * position était donc définitivement hors de portée, pour tous les rôles.
 */
export const INBOX_SCREEN_PAGE_SIZE = 25;

export interface InboxPageFilters {
  page: number;
  /** `true` : ne rendre que les non lues. C'est le seul tri utile ici. */
  unreadOnly: boolean;
}

export const EMPTY_INBOX_FILTERS: InboxPageFilters = { page: 1, unreadOnly: false };

export async function fetchInboxPage(
  filters: InboxPageFilters,
  client: ApiClient = getApiClient(),
): Promise<Inbox> {
  // `exactOptionalPropertyTypes` : `unreadOnly: false` est une valeur, pas une
  // absence, et l'API la lit comme telle. On ne l'écrit que si elle restreint.
  const query = filters.unreadOnly
    ? { page: filters.page, pageSize: INBOX_SCREEN_PAGE_SIZE, unreadOnly: true }
    : { page: filters.page, pageSize: INBOX_SCREEN_PAGE_SIZE };

  return unwrap(await client.GET('/api/v1/notifications/mine', { params: { query } }));
}

/**
 * Marquage en lu. Idempotent côté API : un second appel ne réécrit pas la
 * première lecture, qui est la seule intéressante.
 *
 * L'identifiant attendu est celui de la NOTIFICATION, pas celui de la livraison
 * (`InboxItemDto.id`) : c'est `notificationId` qu'il faut passer, et les
 * confondre produit un 404 silencieux sur un clic qui a pourtant l'air d'avoir
 * marché.
 */
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

/**
 * « Tout marquer comme lu », composé côté panel.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Il n'existe PAS d'endpoint de marquage global, et ce n'est pas grave.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'API n'expose que `POST /notifications/{id}/read`, idempotent. On lit donc
 * les non-lues page par page et on les marque. Deux garde-fous, et aucun n'est
 * décoratif :
 *
 *  - le nombre de pages est BORNÉ. Un compte laissé six mois sans être ouvert
 *    peut porter des centaines de lignes ; enchaîner autant d'appels sur un
 *    clic saturerait le limiteur de débit de l'API (300 req/min) et
 *    déconnecterait l'utilisateur pour avoir voulu ranger sa boîte. Ce qui
 *    dépasse la borne reste non lu : c'est visible, réparable d'un second clic,
 *    et infiniment préférable à une session cassée.
 *  - on relit la PREMIÈRE page à chaque tour plutôt que d'avancer l'index :
 *    marquer une ligne la retire de la sélection `unreadOnly`, donc la page 2
 *    d'avant est devenue la page 1. Paginer en avançant sauterait une ligne sur
 *    deux.
 *
 * Rend le nombre de notifications réellement marquées : l'écran l'annonce, et
 * un « 0 » se lit comme « il n'y avait rien », jamais comme un échec muet.
 */
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

    // Séquentiel et non `Promise.all` : cinquante requêtes simultanées sur un
    // réseau de terrain se soldent par des délais dépassés, pas par un gain.
    for (const item of page.items) {
      await markNotificationRead(item.notificationId, client);
      marked += 1;
    }
  }

  return marked;
}

// ─── Navigation depuis une notification ──────────────────────────────────────

/**
 * Racines de route RÉELLEMENT servies par le panel.
 *
 * Le champ `route` du modèle est partagé avec le mobile : les rappels de
 * correction pointent vers `/a-corriger`, ceux de phase 2 vers `/phase2`, et
 * ces écrans n'existent pas ici. Naviguer aveuglément afficherait un 404 à
 * quelqu'un qui vient de cliquer sur une notification légitime : la cloche
 * affiche alors la ligne sans en faire un lien, ce qui est exact.
 *
 * Comparaison par SEGMENT et non par simple préfixe de chaîne : sans cela,
 * `/dossiers-archives` passerait pour `/dossiers`.
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
];

export function webRouteFor(route: string | null): string | null {
  if (route === null) return null;
  // Une route absolue et interne, jamais une URL : `//evil.example` est un
  // chemin protocole-relatif que le routeur suivrait hors du domaine.
  if (!route.startsWith('/') || route.startsWith('//')) return null;
  const path = route.split('?')[0] ?? route;
  const matches = WEB_ROUTES.some((known) => path === known || path.startsWith(`${known}/`));
  return matches ? route : null;
}

// ─── Pastille ────────────────────────────────────────────────────────────────

/** Au-delà, la pastille afficherait quatre chiffres et déborderait de la cloche. */
export const UNREAD_BADGE_MAX = 99;

export function unreadBadgeLabel(unreadCount: number): string {
  if (unreadCount <= 0) return '';
  return unreadCount > UNREAD_BADGE_MAX ? `${String(UNREAD_BADGE_MAX)}+` : String(unreadCount);
}

/** Intitulé accessible de la cloche. Le compte est ANNONCÉ, pas seulement peint. */
export function bellLabel(unreadCount: number): string {
  if (unreadCount <= 0) return 'Notifications, aucune non lue';
  return `Notifications, ${String(unreadCount)} non lue${unreadCount > 1 ? 's' : ''}`;
}

/**
 * Une notification VIENT-ELLE d'arriver ?
 *
 * L'oscillation de la cloche ne doit se déclencher que sur une arrivée, pas à
 * chaque sondage : une cloche qui bouge toutes les vingt secondes devient un
 * décor qu'on cesse de voir, ce qui est exactement l'inverse du but. La
 * comparaison porte sur l'identifiant de tête ET sur le compte : deux
 * notifications reçues entre deux sondages ne changent pas la tête une seconde
 * fois, mais font monter le compte.
 */
export function hasNewArrival(
  previous: { topId: string | null; unreadCount: number } | null,
  next: { topId: string | null; unreadCount: number },
): boolean {
  if (previous === null) return false;
  if (next.unreadCount <= 0) return false;
  if (next.topId !== previous.topId) return true;
  return next.unreadCount > previous.unreadCount;
}

/** Tête de liste et compte, résumé de l'inbox pour la comparaison ci-dessus. */
export function inboxSignature(inbox: Inbox | undefined): {
  topId: string | null;
  unreadCount: number;
} {
  if (inbox === undefined) return { topId: null, unreadCount: 0 };
  return { topId: inbox.items[0]?.id ?? null, unreadCount: inbox.unreadCount };
}
