import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as InboxModule from '@/lib/data/inbox';
import { INBOX_SCREEN_PAGE_SIZE } from '@/lib/data/inbox';
import { renderWithQuery } from '@/test/render-query';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * La vingt-et-unième notification devait redevenir ATTEIGNABLE.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Le panneau de la cloche ne montre que les vingt dernières lignes, et son code
 * annonçait « au-delà, un lien vers l'écran complet ». Ce lien n'existait pas,
 * et `/notifications` était le COMPOSEUR, réservé à l'ADMIN. Une notification
 * tombée en vingt-et-unième position était donc définitivement hors de portée,
 * pour un téléconseiller comme pour un agent bancaire.
 *
 * Le test ne se contente pas de constater qu'un bouton « Page suivante »
 * existe : il vérifie que le CONTENU de la seconde page arrive, et que la
 * requête part bien avec `page: 2`. Un bouton qui n'incrémenterait rien aurait
 * exactement la même allure.
 */

const fetchInboxPage = vi.fn();

vi.mock('@/lib/data/inbox', async () => {
  const actual = await vi.importActual<typeof InboxModule>('@/lib/data/inbox');
  return {
    ...actual,
    fetchInboxPage: (filters: { page: number; unreadOnly: boolean }) =>
      fetchInboxPage(filters) as unknown,
    markNotificationRead: () => Promise.resolve(),
    markAllNotificationsRead: () => Promise.resolve(0),
  };
});

const { InboxView } = await import('@/components/notifications/inbox-view');

const TOTAL = INBOX_SCREEN_PAGE_SIZE + 1;

const items = (page: number) => {
  const first = (page - 1) * INBOX_SCREEN_PAGE_SIZE + 1;
  const last = Math.min(page * INBOX_SCREEN_PAGE_SIZE, TOTAL);
  const rows = [];
  for (let n = first; n <= last; n += 1) {
    rows.push({
      id: `liv-${String(n)}`,
      notificationId: `notif-${String(n)}`,
      title: `Annonce numéro ${String(n)}`,
      body: 'Corps de l’annonce.',
      category: 'ANNONCE',
      route: null,
      isRead: true,
      readAt: '2026-08-13T10:00:00.000Z',
      createdAt: '2026-08-13T09:00:00.000Z',
    });
  }
  return rows;
};

const page = (n: number) => ({
  items: items(n),
  unreadCount: 0,
  meta: {
    total: TOTAL,
    page: n,
    pageSize: INBOX_SCREEN_PAGE_SIZE,
    pageCount: Math.ceil(TOTAL / INBOX_SCREEN_PAGE_SIZE),
  },
});

/**
 * L'écran est PILOTÉ par son parent : `page` est une prop, pas un état interne,
 * parce que la page vit dans l'URL. On éprouve donc les deux moitiés
 * séparément : que l'activation demande bien la page suivante, et que la page
 * demandée soit bien rendue.
 */
describe('InboxView, pagination', () => {
  beforeEach(() => {
    fetchInboxPage.mockImplementation(
      (filters: { page: number }) => Promise.resolve(page(filters.page)) as unknown,
    );
  });

  it('affiche la première page et annonce le total', async () => {
    renderWithQuery(
      <InboxView page={1} unreadOnly={false} onPageChange={vi.fn()} onUnreadOnlyChange={vi.fn()} />,
    );

    expect(await screen.findByText('Annonce numéro 1')).toBeTruthy();
    // La vingt-et-unième n'est PAS sur la première page : c'est précisément le
    // cas que la cloche seule ne savait pas montrer.
    expect(screen.queryByText(`Annonce numéro ${String(TOTAL)}`)).toBeNull();
    expect(screen.getByText(new RegExp(`${String(TOTAL)} notifications`))).toBeTruthy();
  });

  it('demande la page suivante quand on l’active', async () => {
    const onPageChange = vi.fn();
    renderWithQuery(
      <InboxView
        page={1}
        unreadOnly={false}
        onPageChange={onPageChange}
        onUnreadOnlyChange={vi.fn()}
      />,
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Page suivante' }));

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('rend la vingt-et-unième notification sur la seconde page', async () => {
    renderWithQuery(
      <InboxView page={2} unreadOnly={false} onPageChange={vi.fn()} onUnreadOnlyChange={vi.fn()} />,
    );

    expect(await screen.findByText(`Annonce numéro ${String(TOTAL)}`)).toBeTruthy();
    await waitFor(() => {
      expect(fetchInboxPage).toHaveBeenCalledWith({ page: 2, unreadOnly: false });
    });
  });

  it('ne propose pas de reculer depuis la première page, ni d’avancer depuis la dernière', async () => {
    const { unmount } = renderWithQuery(
      <InboxView page={1} unreadOnly={false} onPageChange={vi.fn()} onUnreadOnlyChange={vi.fn()} />,
    );
    expect(
      (await screen.findByRole('button', { name: 'Page précédente' })).hasAttribute('disabled'),
    ).toBe(true);
    unmount();

    renderWithQuery(
      <InboxView page={2} unreadOnly={false} onPageChange={vi.fn()} onUnreadOnlyChange={vi.fn()} />,
    );
    expect(
      (await screen.findByRole('button', { name: 'Page suivante' })).hasAttribute('disabled'),
    ).toBe(true);
  });
});
