import { describe, expect, it } from 'vitest';

import { movedTarget } from '@/app/moved-routes';

import {
  bellLabel,
  hasNewArrival,
  inboxSignature,
  MARK_ALL_MAX_PAGES,
  MARK_ALL_PAGE_SIZE,
  markAllNotificationsRead,
  unreadBadgeLabel,
  webRouteFor,
  type Inbox,
} from '@/lib/data/inbox';

describe('webRouteFor', () => {
  it('accepte les écrans réellement servis par le panel', () => {
    expect(webRouteFor('/demandes-clients')).toBe('/demandes-clients');
    expect(webRouteFor('/dossiers')).toBe('/dossiers');
    expect(webRouteFor('/campagnes')).toBe('/campagnes');
  });

  it('accepte une sous-route et une chaîne de requête', () => {
    expect(webRouteFor('/dossiers/019ff658-dddd-7489-ab22-1f2ada5ef38a')).toBe(
      '/dossiers/019ff658-dddd-7489-ab22-1f2ada5ef38a',
    );
    expect(webRouteFor('/demandes-clients?statut=PENDING')).toBe(
      '/demandes-clients?statut=PENDING',
    );
  });

  it('refuse les routes MOBILES, qui n’existent pas ici', () => {
    expect(webRouteFor('/a-corriger')).toBeNull();
  });

  // Les trois rappels quotidiens de `reminders.service.ts`. Refusées, elles
  // rendaient leur notification muette : lue au clic, et menant nulle part.
  it('accepte les adresses des rappels quotidiens', () => {
    expect(webRouteFor('/phase2')).toBe('/phase2');
    expect(webRouteFor('/phase2/callbacks')).toBe('/phase2/callbacks');
    expect(webRouteFor('/rep-campaigns')).toBe('/rep-campaigns');
  });

  it('et chacune atterrit sur un écran servi', () => {
    expect(movedTarget('phase2')).toBe('/chues/campagnes');
    expect(movedTarget('phase2', ['callbacks'])).toBe('/chues/rappels');
    expect(movedTarget('rep-campaigns')).toBe('/chues/campagnes/representants');
  });

  it('ne se laisse pas piéger par un préfixe partiel', () => {
    expect(webRouteFor('/dossiers-archives')).toBeNull();
  });

  it('refuse tout ce qui pourrait sortir du domaine', () => {
    expect(webRouteFor('//evil.example/phishing')).toBeNull();
    expect(webRouteFor('https://evil.example')).toBeNull();
    expect(webRouteFor('dossiers')).toBeNull();
    expect(webRouteFor(null)).toBeNull();
  });
});

describe('hasNewArrival', () => {
  it('ne s’anime pas au premier chargement', () => {
    expect(hasNewArrival(null, { topId: 'a', unreadCount: 3 })).toBe(false);
  });

  it('ne s’anime pas quand rien n’a changé entre deux sondages', () => {
    expect(hasNewArrival({ topId: 'a', unreadCount: 3 }, { topId: 'a', unreadCount: 3 })).toBe(
      false,
    );
  });

  it('s’anime quand une nouvelle notification prend la tête', () => {
    expect(hasNewArrival({ topId: 'a', unreadCount: 3 }, { topId: 'b', unreadCount: 4 })).toBe(
      true,
    );
  });

  it('s’anime aussi quand seul le compte monte', () => {
    expect(hasNewArrival({ topId: 'a', unreadCount: 3 }, { topId: 'a', unreadCount: 5 })).toBe(
      true,
    );
  });

  it('ne s’anime jamais sans non-lu', () => {
    expect(hasNewArrival({ topId: 'a', unreadCount: 1 }, { topId: 'b', unreadCount: 0 })).toBe(
      false,
    );
  });
});

describe('inboxSignature', () => {
  it('rend une signature neutre tant que rien n’est chargé', () => {
    expect(inboxSignature(undefined)).toEqual({ topId: null, unreadCount: 0 });
  });

  it('retient la tête de liste et le compte', () => {
    const inbox = {
      items: [
        {
          id: 'delivery-1',
          notificationId: 'notif-1',
          title: 'Demande de création',
          body: 'CBAO',
          category: 'SYSTEME',
          route: '/demandes-clients',
          isRead: false,
          readAt: null,
          createdAt: '2026-08-13T10:00:00.000Z',
        },
      ],
      unreadCount: 1,
      meta: { total: 1, page: 1, pageSize: 20, pageCount: 1 },
    } satisfies Inbox;

    expect(inboxSignature(inbox)).toEqual({ topId: 'delivery-1', unreadCount: 1 });
  });
});

describe('pastille et intitulé', () => {
  it('plafonne l’affichage pour ne pas déborder de la cloche', () => {
    expect(unreadBadgeLabel(0)).toBe('');
    expect(unreadBadgeLabel(7)).toBe('7');
    expect(unreadBadgeLabel(99)).toBe('99');
    expect(unreadBadgeLabel(1240)).toBe('99+');
  });

  it('ANNONCE le compte, il n’est pas seulement peint', () => {
    expect(bellLabel(0)).toBe('Notifications, aucune non lue');
    expect(bellLabel(1)).toBe('Notifications, 1 non lue');
    expect(bellLabel(4)).toBe('Notifications, 4 non lues');
  });
});

function fakeInboxClient(unreadIds: string[]) {
  const remaining = new Set(unreadIds);
  const read: string[] = [];
  let pagesFetched = 0;

  const client = {
    GET: (_path: string, options: { params: { query: { pageSize: number } } }) => {
      pagesFetched += 1;
      const items = [...remaining].slice(0, options.params.query.pageSize).map((id) => ({
        id: `livraison-${id}`,
        notificationId: id,
        title: 'x',
        body: 'x',
        category: 'ANNONCE',
        route: null,
        isRead: false,
        readAt: null,
        createdAt: '2026-08-13T09:00:00.000Z',
      }));
      return Promise.resolve({
        data: {
          items,
          unreadCount: remaining.size,
          meta: {
            total: remaining.size,
            page: 1,
            pageSize: options.params.query.pageSize,
            pageCount: 1,
          },
        },
        error: undefined,
        response: new Response(null, { status: 200 }),
      });
    },
    POST: (_path: string, options: { params: { path: { id: string } } }) => {
      const id = options.params.path.id;
      remaining.delete(id);
      read.push(id);
      return Promise.resolve({
        data: undefined,
        error: undefined,
        response: new Response(null, { status: 204 }),
      });
    },
  };

  return { client, read, pagesFetched: () => pagesFetched, remaining };
}

describe('markAllNotificationsRead', () => {
  it('marque TOUTES les non lues, au-delà d’une page', async () => {
    const ids = Array.from({ length: MARK_ALL_PAGE_SIZE + 7 }, (_, i) => `n-${String(i)}`);
    const fake = fakeInboxClient(ids);

    const marked = await markAllNotificationsRead(fake.client as never);

    expect(marked).toBe(ids.length);
    expect(fake.remaining.size).toBe(0);
    expect(new Set(fake.read)).toEqual(new Set(ids));
  });

  it('rend 0 sans rien appeler quand la boîte est déjà à jour', async () => {
    const fake = fakeInboxClient([]);
    expect(await markAllNotificationsRead(fake.client as never)).toBe(0);
    expect(fake.read).toEqual([]);
  });

  it('BORNE le nombre de pages, pour ne pas se faire limiter en débit', async () => {
    const ids = Array.from(
      { length: MARK_ALL_PAGE_SIZE * (MARK_ALL_MAX_PAGES + 3) },
      (_, i) => `n-${String(i)}`,
    );
    const fake = fakeInboxClient(ids);

    const marked = await markAllNotificationsRead(fake.client as never);

    expect(marked).toBe(MARK_ALL_PAGE_SIZE * MARK_ALL_MAX_PAGES);
    expect(fake.remaining.size).toBeGreaterThan(0);
    expect(fake.pagesFetched()).toBe(MARK_ALL_MAX_PAGES);
  });
});
