import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ActivityView } from '@/components/supervision/activity-view';
import type * as AdminModule from '@/lib/data/admin';
import { renderWithQuery } from '@/test/render-query';

vi.mock('@/lib/data/admin', async () => {
  const actual = await vi.importActual<typeof AdminModule>('@/lib/data/admin');
  return { ...actual, fetchSupervisionActivite: fetchMock };
});

const fetchMock = vi.hoisted(() => vi.fn());

const ALICE = '11111111-1111-1111-1111-111111111111';
const BINETA = '22222222-2222-2222-2222-222222222222';

function payload(overrides: Partial<AdminModule.SupervisionActivity> = {}) {
  return {
    from: '2026-08-17T00:00:00.000Z',
    to: '2026-08-17T23:59:59.999Z',
    granularity: 'day',
    items: [
      {
        bucket: '2026-08-17',
        teleconseillerId: ALICE,
        teleconseillerName: 'Alice Diop',
        calls: 4,
        unreachable: 1,
        wrongNumber: 1,
        refused: 1,
        other: 0,
        methodObtained: 1,
        callback: 0,
        reachRate: 50,
        prospectsCreated: 2,
        representantsContacted: 2,
      },
    ],
    teleconseillers: [
      { id: ALICE, fullName: 'Alice Diop', isActive: true },
      { id: BINETA, fullName: 'Bineta Fall', isActive: true },
    ],
    ...overrides,
  };
}

function rowOf(name: string): HTMLElement {
  const cell = screen.getByRole('rowheader', { name: new RegExp(name, 'u') });
  const row = cell.closest('tr');
  if (row === null) throw new Error(`Ligne introuvable pour ${name}`);
  return row;
}

describe('tableau d’activité des téléconseillers', () => {
  it('montre le téléconseiller sans aucun acte, à zéro et signalé', async () => {
    fetchMock.mockResolvedValue(payload());

    renderWithQuery(<ActivityView />);

    await waitFor(() => {
      expect(screen.getByRole('rowheader', { name: /Alice Diop/u })).toBeTruthy();
    });
    const bineta = rowOf('Bineta Fall');
    expect(within(bineta).getByText('Aucun acte')).toBeTruthy();
    expect(within(bineta).getAllByRole('cell')[0]?.textContent).toBe('0');
  });

  it('distingue un taux de joignabilité absent d’un taux nul', async () => {
    fetchMock.mockResolvedValue(
      payload({
        items: [
          {
            ...payload().items[0],
            calls: 3,
            unreachable: 2,
            wrongNumber: 1,
            reachRate: 0,
          } as AdminModule.ActivityRow,
        ],
      }),
    );

    renderWithQuery(<ActivityView />);

    await waitFor(() => {
      expect(screen.getByRole('rowheader', { name: /Alice Diop/u })).toBeTruthy();
    });
    expect(within(rowOf('Alice Diop')).getAllByRole('cell')[6]?.textContent).toBe('0 %');
    expect(within(rowOf('Bineta Fall')).getAllByRole('cell')[6]?.textContent).toBe('Sans objet');
  });

  it('affiche le total d’équipe et la moyenne par téléconseiller', async () => {
    fetchMock.mockResolvedValue(payload());

    renderWithQuery(<ActivityView />);

    await waitFor(() => {
      expect(screen.getByRole('rowheader', { name: 'Total équipe' })).toBeTruthy();
    });
    const totals = rowOf('Total équipe');
    expect(within(totals).getAllByRole('cell')[0]?.textContent).toBe('4');
    expect(within(rowOf('Moyenne par téléconseiller')).getAllByRole('cell')[0]?.textContent).toBe(
      '2,0',
    );
  });

  it('trie sur la colonne cliquée', async () => {
    fetchMock.mockResolvedValue(payload());

    renderWithQuery(<ActivityView />);

    await waitFor(() => {
      expect(screen.getByRole('rowheader', { name: /Alice Diop/u })).toBeTruthy();
    });
    expect(screen.getAllByRole('rowheader')[0]?.textContent).toContain('Alice Diop');

    await userEvent.click(screen.getByRole('button', { name: /Appels/u }));

    expect(screen.getAllByRole('rowheader')[0]?.textContent).toContain('Bineta Fall');
  });

  it('bascule la fenêtre de jour en semaine', async () => {
    fetchMock.mockResolvedValue(payload());

    renderWithQuery(<ActivityView />);

    await waitFor(() => {
      expect(screen.getByRole('rowheader', { name: /Alice Diop/u })).toBeTruthy();
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.objectContaining({ granularity: 'day' }) as unknown,
    );
    expect(screen.getByText('Équipe, par jour')).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Par semaine' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ granularity: 'week' }) as unknown,
      );
    });
    expect(screen.getByText('Équipe, par semaine')).toBeTruthy();
  });

  it('demande la fenêtre du jour, puis celle des sept derniers jours', async () => {
    fetchMock.mockResolvedValue(payload());

    renderWithQuery(<ActivityView />);

    await waitFor(() => {
      expect(screen.getByRole('rowheader', { name: /Alice Diop/u })).toBeTruthy();
    });
    const firstCall = fetchMock.mock.calls[0]?.[0] as { range: { from: string; to: string } };
    expect(firstCall.range.from).toBe(firstCall.range.to);

    await userEvent.click(screen.getByRole('button', { name: '7 derniers jours' }));

    await waitFor(() => {
      const last = fetchMock.mock.calls.at(-1)?.[0] as { range: { from: string; to: string } };
      expect(last.range.from < last.range.to).toBe(true);
    });
  });
});
