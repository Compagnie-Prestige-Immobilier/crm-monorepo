import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ActivityView } from '@/components/supervision/activity-view';
import type * as CsvModule from '@/lib/csv';
import type * as AdminModule from '@/lib/data/admin';
import { renderWithQuery } from '@/test/render-query';

vi.mock('@/lib/data/admin', async () => {
  const actual = await vi.importActual<typeof AdminModule>('@/lib/data/admin');
  return { ...actual, fetchSupervisionActivite: fetchMock };
});

vi.mock('@/lib/csv', async () => {
  const actual = await vi.importActual<typeof CsvModule>('@/lib/csv');
  return { ...actual, downloadCsv: downloadMock };
});

const fetchMock = vi.hoisted(() => vi.fn());
const downloadMock = vi.hoisted(() => vi.fn());

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
        repCalls: 10,
        repReached: 6,
        repCallback: 2,
        repUnreachable: 2,
        repOther: 0,
        repContactRate: 60,
        repCallbackRate: 20,
        repQuestioned: 5,
        repQualified: 4,
        repQualificationRate: 80,
      },
    ],
    teleconseillers: [
      { id: ALICE, fullName: 'Alice Diop', isActive: true },
      { id: BINETA, fullName: 'Bineta Fall', isActive: true },
    ],
    scores: [],
    ...overrides,
  };
}

const PARTS = [
  { key: 'assiduite', label: 'Assiduité', ratio: 0.9, weight: 0.2 },
  { key: 'regularite', label: 'Régularité', ratio: 0.8, weight: 0.15 },
  { key: 'rythme', label: 'Rythme', ratio: 0.68, weight: 0.25 },
  { key: 'contact', label: 'Contact', ratio: 0.5, weight: 0.2 },
  { key: 'qualification', label: 'Qualification', ratio: 0.4, weight: 0.15 },
  { key: 'efficience', label: 'Efficience', ratio: 1, weight: 0.05 },
] as const;

function scoreRow(
  id: string,
  name: string,
  score: AdminModule.PerformanceScore,
): AdminModule.SupervisionScore {
  return {
    teleconseillerId: id,
    teleconseillerName: name,
    activeSecondsInShifts: 10_800,
    shiftSecondsElapsed: 14_400,
    calls: 24,
    reached: 12,
    qualified: 6,
    repeatCalls: 3,
    deadSeconds: 2520,
    score,
  };
}

function rendementTable(): HTMLElement {
  return screen.getByRole('table', { name: /Rendement sur la période/u });
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

    renderWithQuery(<ActivityView projet="CHUES" />);

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

    renderWithQuery(<ActivityView projet="GRAND_PUBLIC" />);

    await waitFor(() => {
      expect(screen.getByRole('rowheader', { name: /Alice Diop/u })).toBeTruthy();
    });
    expect(within(rowOf('Alice Diop')).getAllByRole('cell')[5]?.textContent).toBe('0 %');
    expect(within(rowOf('Bineta Fall')).getAllByRole('cell')[5]?.textContent).toBe('Sans objet');
  });

  it('compte les appels aux représentants en CHUES, ceux aux prospects en Grand Public', async () => {
    fetchMock.mockResolvedValue(payload());

    const { unmount } = renderWithQuery(<ActivityView projet="CHUES" />);
    await waitFor(() => {
      expect(screen.getByRole('rowheader', { name: /Alice Diop/u })).toBeTruthy();
    });
    const chues = within(rowOf('Alice Diop')).getAllByRole('cell');
    expect(chues[0]?.textContent).toBe('10');
    expect(chues[4]?.textContent).toBe('60 %');
    expect(chues[5]?.textContent).toBe('80 %');
    expect(screen.queryByRole('button', { name: /Faux numéros/u })).toBeNull();
    unmount();

    renderWithQuery(<ActivityView projet="GRAND_PUBLIC" />);
    await waitFor(() => {
      expect(screen.getByRole('rowheader', { name: /Alice Diop/u })).toBeTruthy();
    });
    const gp = within(rowOf('Alice Diop')).getAllByRole('cell');
    expect(gp[0]?.textContent).toBe('4');
    // Un faux numéro compte parmi les injoignables.
    expect(gp[2]?.textContent).toBe('2');
    expect(screen.queryByRole('button', { name: 'Appels prospects' })).toBeNull();
  });

  it('bascule en CHUES des appels aux représentants vers ceux aux prospects', async () => {
    fetchMock.mockResolvedValue(payload());

    renderWithQuery(<ActivityView projet="CHUES" />);
    await waitFor(() => {
      expect(screen.getByRole('rowheader', { name: /Alice Diop/u })).toBeTruthy();
    });
    expect(within(rowOf('Alice Diop')).getAllByRole('cell')).toHaveLength(8);

    await userEvent.click(screen.getByRole('button', { name: 'Appels prospects' }));

    const cells = within(rowOf('Alice Diop')).getAllByRole('cell');
    expect(cells).toHaveLength(7);
    expect(cells[0]?.textContent).toBe('4');
    expect(screen.queryByRole('button', { name: /Représentants contactés/u })).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Exporter en CSV' }));
    const csv = downloadMock.mock.calls.at(-1)?.[0] as string;
    expect(csv).toContain('Appels prospects');
    expect(downloadMock.mock.calls.at(-1)?.[1]).toContain('chues-prospects');
  });

  it('affiche le total d’équipe et la moyenne par téléconseiller', async () => {
    fetchMock.mockResolvedValue(payload());

    renderWithQuery(<ActivityView projet="CHUES" />);

    await waitFor(() => {
      expect(screen.getByRole('rowheader', { name: 'Total équipe' })).toBeTruthy();
    });
    const totals = rowOf('Total équipe');
    expect(within(totals).getAllByRole('cell')[0]?.textContent).toBe('10');
    expect(within(rowOf('Moyenne par téléconseiller')).getAllByRole('cell')[0]?.textContent).toBe(
      '5,0',
    );
  });

  it('trie sur la colonne cliquée', async () => {
    fetchMock.mockResolvedValue(payload());

    renderWithQuery(<ActivityView projet="CHUES" />);

    await waitFor(() => {
      expect(screen.getByRole('rowheader', { name: /Alice Diop/u })).toBeTruthy();
    });
    expect(screen.getAllByRole('rowheader')[0]?.textContent).toContain('Alice Diop');

    await userEvent.click(screen.getByRole('button', { name: 'Appels' }));

    expect(screen.getAllByRole('rowheader')[0]?.textContent).toContain('Bineta Fall');
  });

  it('bascule la fenêtre de jour en semaine', async () => {
    fetchMock.mockResolvedValue(payload());

    renderWithQuery(<ActivityView projet="CHUES" />);

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

  it('borne les chiffres au projet de la coque', async () => {
    fetchMock.mockResolvedValue(payload());

    renderWithQuery(<ActivityView projet="GRAND_PUBLIC" />);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenLastCalledWith(
        expect.objectContaining({ projet: 'GRAND_PUBLIC' }) as unknown,
      );
    });
  });

  it('retire la colonne des représentants en Grand Public', async () => {
    fetchMock.mockResolvedValue(payload());

    renderWithQuery(<ActivityView projet="GRAND_PUBLIC" />);

    await waitFor(() => {
      expect(screen.getByRole('rowheader', { name: /Alice Diop/u })).toBeTruthy();
    });
    expect(screen.queryByRole('button', { name: /Représentants contactés/u })).toBeNull();
    expect(within(rowOf('Alice Diop')).getAllByRole('cell')).toHaveLength(7);
    expect(within(rowOf('Total équipe')).getAllByRole('cell')).toHaveLength(7);
  });

  it('la garde en CHUES, et nomme le projet dans le CSV', async () => {
    fetchMock.mockResolvedValue(payload());

    renderWithQuery(<ActivityView projet="CHUES" />);

    await waitFor(() => {
      expect(screen.getByRole('rowheader', { name: /Alice Diop/u })).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /Représentants contactés/u })).toBeTruthy();
    expect(within(rowOf('Alice Diop')).getAllByRole('cell')).toHaveLength(8);

    await userEvent.click(screen.getByRole('button', { name: 'Exporter en CSV' }));

    const csv = downloadMock.mock.calls.at(-1)?.[0] as string;
    expect(csv).toContain('Activité des téléconseillers CHUES');
    expect(csv).toContain('Représentants contactés');
  });

  it('exporte un CSV sans colonne représentant en Grand Public', async () => {
    fetchMock.mockResolvedValue(payload());

    renderWithQuery(<ActivityView projet="GRAND_PUBLIC" />);

    await waitFor(() => {
      expect(screen.getByRole('rowheader', { name: /Alice Diop/u })).toBeTruthy();
    });
    await userEvent.click(screen.getByRole('button', { name: 'Exporter en CSV' }));

    const csv = downloadMock.mock.calls.at(-1)?.[0] as string;
    expect(csv).toContain('Activité des téléconseillers Grand Public');
    expect(csv).not.toContain('Représentants contactés');
  });

  it('demande la fenêtre du jour, puis celle des sept derniers jours', async () => {
    fetchMock.mockResolvedValue(payload());

    renderWithQuery(<ActivityView projet="CHUES" />);

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

describe('rendement sur la période', () => {
  async function render(scores: AdminModule.SupervisionScore[]): Promise<void> {
    fetchMock.mockResolvedValue(payload({ scores }));
    renderWithQuery(<ActivityView projet="CHUES" />);
    await waitFor(() => {
      expect(rendementTable()).toBeTruthy();
    });
  }

  it('affiche le motif au lieu d’une note quand elle ne peut pas être calculée', async () => {
    await render([
      scoreRow(ALICE, 'Alice Diop', { value: null, reason: 'aucun_appel', parts: [] }),
      scoreRow(BINETA, 'Bineta Fall', {
        value: null,
        reason: 'presence_non_mesuree',
        parts: [],
      }),
    ]);

    const rows = within(rendementTable()).getAllByRole('rowheader');
    expect(rows).toHaveLength(2);
    for (const [index, motif] of ['Aucun appel', 'Présence non mesurée'].entries()) {
      const row = rows[index]?.closest('tr');
      expect(within(row as HTMLElement).getAllByRole('cell')[0]?.textContent).toBe(motif);
    }
  });

  it('range les comptes sans note derrière les notes basses', async () => {
    await render([
      scoreRow(BINETA, 'Bineta Fall', { value: null, reason: 'aucun_appel', parts: [] }),
      scoreRow(ALICE, 'Alice Diop', { value: 0, reason: null, parts: [...PARTS] }),
    ]);

    const names = within(rendementTable())
      .getAllByRole('rowheader')
      .map((cell) => cell.textContent ?? '');
    expect(names).toEqual([
      expect.stringContaining('Alice Diop'),
      expect.stringContaining('Bineta Fall'),
    ]);
  });

  it('déplie les six parts de la note et les entrées du calcul', async () => {
    await render([scoreRow(ALICE, 'Alice Diop', { value: 74, reason: null, parts: [...PARTS] })]);

    const toggle = within(rendementTable()).getByRole('button', { name: /Alice Diop/u });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    await userEvent.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    const detail = within(rendementTable()).getByRole('cell', { name: /Détail de la note/u });
    for (const part of PARTS) {
      expect(within(detail).getByText(part.label)).toBeTruthy();
    }
    expect(within(detail).getByText('68 %')).toBeTruthy();
    expect(within(detail).getByText('poids 25 %')).toBeTruthy();
    expect(within(detail).getByText('8,0')).toBeTruthy();

    await userEvent.click(toggle);
    expect(screen.queryByText('Détail de la note')).toBeNull();
  });

  it('tient une période sans aucune note sans masquer le reste de l’écran', async () => {
    await render([]);

    expect(within(rendementTable()).getByText(/Aucune note sur cette période/u)).toBeTruthy();
    expect(screen.getByRole('rowheader', { name: /Alice Diop/u })).toBeTruthy();
  });

  it('dit que les jours sans présence ne comptent pas', async () => {
    await render([]);

    expect(screen.getByText(/un dimanche ou un congé ne fait pas baisser la note/u)).toBeTruthy();
  });
});
