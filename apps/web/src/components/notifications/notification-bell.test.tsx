import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as InboxModule from '@/lib/data/inbox';
import { renderWithQuery } from '@/test/render-query';

/**
 * La cloche est le PREMIER consommateur web de `/notifications/mine`.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Trois promesses, dont deux n'existaient pas avant le correctif.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. le compte de non-lues est ANNONCÉ, pas seulement peint : la pastille est
 *    `aria-hidden`, donc c'est l'intitulé du bouton qui porte l'information ;
 * 2. ouvrir une ligne la marque comme lue ;
 * 3. « Tout voir » mène à la boîte de réception. Ce lien MANQUAIT : le
 *    commentaire du composant le promettait, la vingt-et-unième notification
 *    reçue était pourtant inatteignable, pour tous les rôles.
 *
 * On éprouve la troisième par sa CIBLE et pas seulement par sa présence : un
 * lien vers `/notifications` sans l'onglet « réception » retomberait sur le
 * composeur, réservé à l'ADMIN, ce qui rejouerait exactement le défaut corrigé.
 */

const markNotificationRead = vi.fn((id: string) => Promise.resolve(id));
const fetchInbox = vi.fn();

vi.mock('@/lib/data/inbox', async () => {
  const actual = await vi.importActual<typeof InboxModule>('@/lib/data/inbox');
  return {
    ...actual,
    fetchInbox: () => fetchInbox() as unknown,
    markNotificationRead: (id: string) => markNotificationRead(id),
    markAllNotificationsRead: () => Promise.resolve(0),
  };
});

const { NotificationBell } = await import('@/components/notifications/notification-bell');

const item = (over: Partial<Record<string, unknown>> = {}) => ({
  id: 'liv-1',
  notificationId: 'notif-1',
  title: 'Demande de création à arbitrer',
  body: 'Une banque a déposé une demande.',
  category: 'DOSSIER',
  route: '/demandes-clients',
  isRead: false,
  readAt: null,
  createdAt: '2026-08-13T09:00:00.000Z',
  ...over,
});

/**
 * La ligne, atteinte par son TITRE puis remontée jusqu'au bouton.
 *
 * `getByRole('button', { name: … })` échoue ici : l'intitulé calculé d'une ligne
 * concatène le titre, la catégorie, le corps et l'horodatage, si bien qu'aucune
 * chaîne stable ne le désigne. Le titre, lui, est ce que l'utilisateur lit et
 * vise ; le bouton est son ancêtre le plus proche.
 */
const rowButton = async (): Promise<HTMLElement> => {
  const title = await screen.findByText('Demande de création à arbitrer');
  const button = title.closest('button');
  if (button === null) throw new Error('La ligne de notification n’est pas cliquable.');
  return button;
};

describe('NotificationBell', () => {
  beforeEach(() => {
    // `restoreMocks` rétablit les espions posés par `vi.spyOn`, pas l'historique
    // d'un `vi.fn()` de module : sans ce nettoyage, « ne remarque pas une ligne
    // déjà lue » verrait l'appel du test précédent et échouerait à tort.
    markNotificationRead.mockClear();
    fetchInbox.mockReturnValue(
      Promise.resolve({
        items: [
          item(),
          item({
            id: 'liv-2',
            notificationId: 'notif-2',
            title: 'Campagne clôturée',
            isRead: true,
          }),
        ],
        unreadCount: 3,
        meta: { total: 2, page: 1, pageSize: 20, pageCount: 1 },
      }),
    );
  });

  it('annonce le nombre de non-lues dans l’intitulé du bouton', async () => {
    renderWithQuery(<NotificationBell />);

    // La pastille rouge est `aria-hidden` : seul l'intitulé porte le compte.
    expect(await screen.findByRole('button', { name: 'Notifications, 3 non lues' })).toBeTruthy();
  });

  it('accorde l’intitulé au singulier et à l’absence', async () => {
    fetchInbox.mockReturnValue(
      Promise.resolve({
        items: [],
        unreadCount: 0,
        meta: { total: 0, page: 1, pageSize: 20, pageCount: 0 },
      }),
    );
    renderWithQuery(<NotificationBell />);

    expect(
      await screen.findByRole('button', { name: 'Notifications, aucune non lue' }),
    ).toBeTruthy();
  });

  it('mène à la boîte de réception, onglet réception, et non au composeur', async () => {
    renderWithQuery(<NotificationBell />);

    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }));

    const all = await screen.findByRole('link', { name: 'Tout voir' });
    expect(all.getAttribute('href')).toBe('/notifications?onglet=reception');
  });

  it('marque une ligne non lue à l’ouverture', async () => {
    renderWithQuery(<NotificationBell />);

    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }));
    await userEvent.click(await rowButton());

    // L'identifiant passé est celui de la NOTIFICATION, pas celui de la
    // livraison : les confondre produit un 404 sur un clic qui a l'air d'avoir
    // marché.
    await waitFor(() => {
      expect(markNotificationRead).toHaveBeenCalledWith('notif-1');
    });
  });

  it('ne remarque pas une ligne déjà lue', async () => {
    fetchInbox.mockReturnValue(
      Promise.resolve({
        items: [item({ isRead: true, readAt: '2026-08-13T10:00:00.000Z' })],
        unreadCount: 0,
        meta: { total: 1, page: 1, pageSize: 20, pageCount: 1 },
      }),
    );
    renderWithQuery(<NotificationBell />);

    await userEvent.click(await screen.findByRole('button', { name: /Notifications/ }));
    await userEvent.click(await rowButton());

    expect(markNotificationRead).not.toHaveBeenCalled();
  });
});
