import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RepresentantsSuiviView } from '@/components/rappels/representants-suivi-view';
import type * as RepresentantsData from '@/lib/data/representants';
import type { RepresentantRow } from '@/lib/types';
import { renderWithQuery } from '@/test/render-query';

const fetchRepresentantsSuivi = vi.fn();
const fetchUsers = vi.fn();

vi.mock('@/lib/data/representants', async (importOriginal) => {
  const actual = await importOriginal<typeof RepresentantsData>();
  return {
    ...actual,
    fetchRepresentantsSuivi: (...args: unknown[]) => fetchRepresentantsSuivi(...args) as unknown,
  };
});

vi.mock('@/lib/data/users', () => ({
  fetchUsers: (...args: unknown[]) => fetchUsers(...args) as unknown,
}));

function rep(over: Partial<RepresentantRow> & { id: string }): RepresentantRow {
  return {
    fullName: 'Aminata Ndiaye',
    phoneE164: '+221771234567',
    notes: null,
    rev: 1,
    departementId: 'd-1',
    departementName: 'Dakar',
    iefId: null,
    iefName: null,
    createdById: 'u-1',
    createdByName: 'Fatou Sow',
    clientCreatedAt: '2026-01-01T00:00:00.000Z',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    prospectCount: 0,
    relationStatus: 'CONTACTE',
    statutQualificationId: null,
    statutQualificationLabel: null,
    callAttemptCount: 0,
    whatsappStatus: 'NON_DEMANDE',
    whatsappE164: null,
    whatsappNumber: null,
    profession: null,
    prenom: null,
    etablissement: 'Lycée Blaise Diagne',
    syndicat: null,
    connaitUES: null,
    contacte: null,
    lastCallOutcome: 'CALLBACK',
    lastCallAt: '2026-08-16T09:00:00.000Z',
    lastCallById: 'u-1',
    lastCallByName: 'Fatou Sow',
    nextCallbackAt: null,
    ...over,
  };
}

const EN_RETARD = rep({
  id: 'r-1',
  nextCallbackAt: '2020-03-04T09:00:00.000Z',
});

const A_VENIR = rep({
  id: 'r-2',
  fullName: 'Ousmane Fall',
  phoneE164: '+221770000002',
  nextCallbackAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
});

const INJOIGNABLE = rep({
  id: 'r-3',
  fullName: 'Bineta Diop',
  phoneE164: '+221779876543',
  lastCallOutcome: 'UNREACHABLE',
  lastCallAt: '2026-08-16T09:00:00.000Z',
});

const page = (items: readonly RepresentantRow[], total = items.length) => ({
  items: [...items],
  total,
  page: 1,
  pageSize: 100,
  pageCount: 1,
});

function serve(bySuivi: Partial<Record<RepresentantsData.RepresentantSuivi, RepresentantRow[]>>) {
  fetchRepresentantsSuivi.mockImplementation((suivi: RepresentantsData.RepresentantSuivi) =>
    Promise.resolve(page(bySuivi[suivi] ?? [])),
  );
}

async function renderView(canFilter = false, userId = 'u-1') {
  const view = renderWithQuery(<RepresentantsSuiviView userId={userId} canFilter={canFilter} />);
  await screen.findByRole('group', { name: 'Suivi des représentants' });
  return view;
}

beforeEach(() => {
  fetchRepresentantsSuivi.mockReset();
  fetchUsers.mockReset();
  fetchUsers.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 200, pageCount: 1 });
  serve({ A_RAPPELER: [EN_RETARD, A_VENIR], INJOIGNABLE: [INJOIGNABLE] });
});

describe('RepresentantsSuiviView', () => {
  it('ouvre sur les rappels dus, avec nom, numéro et établissement', async () => {
    await renderView();

    const ligne = (await screen.findByText('Aminata Ndiaye')).closest('tr') as HTMLElement;
    expect(within(ligne).getByText('+221 77 123 45 67')).toBeTruthy();
    expect(within(ligne).getByText('Lycée Blaise Diagne')).toBeTruthy();
    expect(within(ligne).getByRole('link', { name: 'Aminata Ndiaye' }).getAttribute('href')).toBe(
      '/chues/representants/r-1',
    );
  });

  it('marque « En retard » la seule échéance dépassée', async () => {
    await renderView();

    const dus = (await screen.findByText('Aminata Ndiaye')).closest('tr') as HTMLElement;
    const aVenir = screen.getByText('Ousmane Fall').closest('tr') as HTMLElement;

    expect(within(dus).getByText('En retard')).toBeTruthy();
    expect(within(aVenir).queryByText('En retard')).toBeNull();
  });

  it('bascule sur les injoignables et redemande la liste au serveur', async () => {
    await renderView();
    await screen.findByText('Aminata Ndiaye');

    await userEvent.click(screen.getByRole('button', { name: 'Injoignables' }));

    expect(await screen.findByText('Bineta Diop')).toBeTruthy();
    expect(screen.getByText('Dernier appel')).toBeTruthy();
    expect(fetchRepresentantsSuivi).toHaveBeenLastCalledWith('INJOIGNABLE', 'u-1');
  });

  it('borne un téléconseiller à ses propres appels, sans lui offrir le filtre', async () => {
    await renderView(false, 'u-7');

    await waitFor(() => {
      expect(fetchRepresentantsSuivi).toHaveBeenCalledWith('A_RAPPELER', 'u-7');
    });
    expect(screen.queryByLabelText('Appelé par')).toBeNull();
    expect(screen.queryByRole('columnheader', { name: 'Appelé par' })).toBeNull();
    expect(fetchUsers).not.toHaveBeenCalled();
  });

  it('laisse l’encadrement voir tout le monde, puis filtrer sur un téléconseiller', async () => {
    fetchUsers.mockResolvedValue({
      items: [{ id: 'u-2', fullName: 'Awa Ba', isActive: true }],
      total: 1,
      page: 1,
      pageSize: 200,
      pageCount: 1,
    });
    await renderView(true);

    expect(fetchRepresentantsSuivi).toHaveBeenCalledWith('A_RAPPELER', null);
    expect(await screen.findByRole('columnheader', { name: 'Appelé par' })).toBeTruthy();

    await userEvent.click(await screen.findByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: /Awa Ba/u }));

    await waitFor(() => {
      expect(fetchRepresentantsSuivi).toHaveBeenLastCalledWith('A_RAPPELER', 'u-2');
    });
  });

  it('avoue que la liste est coupée quand le serveur en a davantage', async () => {
    fetchRepresentantsSuivi.mockResolvedValue(page([EN_RETARD], 240));
    await renderView();

    expect(await screen.findByText(/240 au total, les 100 premiers sont affichés/u)).toBeTruthy();
  });

  it('dit quoi attendre quand aucun représentant n’est en attente', async () => {
    serve({});
    await renderView();

    expect(await screen.findByText('Aucun représentant à rappeler')).toBeTruthy();
  });
});
