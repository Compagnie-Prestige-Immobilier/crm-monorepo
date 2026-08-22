import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RappelsView } from '@/components/rappels/rappels-view';
import type * as ConsoleData from '@/lib/data/console';
import type { Callback, CallbackScope } from '@/lib/data/console';
import { renderWithQuery } from '@/test/render-query';

const fetchCallbacks = vi.fn();
const cancelCallback = vi.fn();
const fetchUsers = vi.fn();
const toastError = vi.fn();

vi.mock('@/lib/data/console', async (importOriginal) => {
  const actual = await importOriginal<typeof ConsoleData>();
  return {
    ...actual,
    fetchCallbacks: (...args: unknown[]) => fetchCallbacks(...args) as unknown,
    cancelCallback: (...args: unknown[]) => cancelCallback(...args) as unknown,
  };
});

vi.mock('@/lib/data/users', () => ({
  fetchUsers: (...args: unknown[]) => fetchUsers(...args) as unknown,
}));

vi.mock('sonner', () => ({
  toast: {
    error: (message: string) => {
      toastError(message);
    },
    success: vi.fn(),
  },
}));

const SERVER_TIME = '2026-08-16T12:00:00.000Z';

function callback(over: Partial<Callback> & { id: string }): Callback {
  return {
    prospectId: `p-${over.id}`,
    shortCode: 'AB12CD',
    phoneE164: '+221771234567',
    scheduledAt: '2026-08-16T15:00:00.000Z',
    comment: null,
    assignedToId: 'u-1',
    assignedToName: 'Fatou Sow',
    campaignId: null,
    taskId: null,
    overdue: false,
    ...over,
  };
}

const RETARD = callback({
  id: 'r-1',
  prospectId: 'p-9',
  scheduledAt: '2026-08-16T09:00:00.000Z',
  comment: 'rappeler après la réunion',
  overdue: true,
});

function serve(byScope: Partial<Record<CallbackScope, readonly Callback[]>>): void {
  fetchCallbacks.mockImplementation((scope: CallbackScope) =>
    Promise.resolve({ items: [...(byScope[scope] ?? [])], serverTime: SERVER_TIME }),
  );
}

async function renderView(canFilter = false) {
  const view = renderWithQuery(<RappelsView canFilter={canFilter} />);
  await screen.findByRole('status');
  return view;
}

beforeEach(() => {
  fetchCallbacks.mockReset();
  cancelCallback.mockReset();
  cancelCallback.mockResolvedValue(undefined);
  fetchUsers.mockReset();
  fetchUsers.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 200, pageCount: 1 });
  toastError.mockClear();
  serve({ overdue: [RETARD], today: [RETARD], week: [RETARD] });
});

describe('RappelsView', () => {
  it('met le nombre de retards en évidence', async () => {
    await renderView();

    expect(await screen.findByText(/rappel en retard/)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('1');
  });

  it('donne le numéro, l’heure promise, le commentaire et le retard', async () => {
    await renderView();

    const ligne = (await screen.findByText('+221 77 123 45 67')).closest('tr');
    expect(ligne).not.toBeNull();
    expect(within(ligne as HTMLElement).getByText('aujourd’hui à 09:00')).toBeTruthy();
    expect(within(ligne as HTMLElement).getByText('rappeler après la réunion')).toBeTruthy();
    expect(within(ligne as HTMLElement).getByText('3 h')).toBeTruthy();
  });

  it('ouvre la fiche dans la console d’appel', async () => {
    await renderView();

    const lien = await screen.findByRole('link', { name: /console/ });
    expect(lien.getAttribute('href')).toBe('/chues/console?fiche=p-9');
  });

  it('annule le rappel choisi', async () => {
    await renderView();

    await userEvent.click(await screen.findByRole('button', { name: 'Annuler' }));

    await waitFor(() => {
      expect(cancelCallback).toHaveBeenCalledWith('r-1');
    });
  });

  it('change de volet sans mélanger les files', async () => {
    serve({ overdue: [RETARD], today: [RETARD, callback({ id: 'r-2' })] });
    await renderView();

    await userEvent.click(screen.getByRole('tab', { name: 'Aujourd’hui' }));

    await waitFor(() => {
      expect(screen.getAllByRole('row')).toHaveLength(3);
    });
    expect(fetchCallbacks).toHaveBeenCalledWith('today', null, undefined, 'CHUES');
  });

  it('cache le filtre à un téléconseiller, qui ne voit que sa file', async () => {
    await renderView();

    expect(screen.queryByLabelText('Téléconseiller')).toBeNull();
    expect(fetchUsers).not.toHaveBeenCalled();
  });

  it('laisse la supervision filtrer par téléconseiller', async () => {
    fetchUsers.mockResolvedValue({
      items: [{ id: 'u-2', fullName: 'Awa Ba', isActive: true }],
      total: 1,
      page: 1,
      pageSize: 200,
      pageCount: 1,
    });
    await renderView(true);

    await userEvent.click(await screen.findByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: /Awa Ba/ }));

    await waitFor(() => {
      expect(fetchCallbacks).toHaveBeenCalledWith('overdue', 'u-2', undefined, 'CHUES');
    });
  });

  it('dit quoi faire quand aucun rappel n’attend', async () => {
    serve({});
    await renderView();

    expect(await screen.findByText('Aucun rappel en retard')).toBeTruthy();
  });
});
