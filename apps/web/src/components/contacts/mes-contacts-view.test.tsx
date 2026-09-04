import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MesContactsView } from '@/components/contacts/mes-contacts-view';
import type * as ProspectsData from '@/lib/data/prospects';
import type * as RepresentantsData from '@/lib/data/representants';
import type { Paginated, RepresentantRow } from '@/lib/types';
import { prospectFixture } from '@/test/prospect-fixture';
import { renderWithQuery } from '@/test/render-query';

const fetchRepresentantsAppeles = vi.fn();
const fetchProspectsAppeles = vi.fn();
const fetchUsers = vi.fn();

vi.mock('@/lib/data/representants', async (importOriginal) => {
  const actual = await importOriginal<typeof RepresentantsData>();
  return {
    ...actual,
    fetchRepresentantsAppeles: (...args: unknown[]) =>
      fetchRepresentantsAppeles(...args) as unknown,
  };
});

vi.mock('@/lib/data/prospects', async (importOriginal) => {
  const actual = await importOriginal<typeof ProspectsData>();
  return {
    ...actual,
    fetchProspectsAppeles: (...args: unknown[]) => fetchProspectsAppeles(...args) as unknown,
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
    relationStatus: 'AMBASSADEUR',
    statutQualificationId: null,
    statutQualificationLabel: null,
    statutQualificationEffect: null,
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
    lastCallOutcome: 'PROSPECTS_PROMISED',
    lastCallAt: '2026-08-16T09:00:00.000Z',
    lastCallById: 'u-1',
    lastCallByName: 'Fatou Sow',
    nextCallbackAt: null,
    ...over,
  };
}

const PROSPECT = prospectFixture({
  id: 'p-1',
  nom: 'Diouf',
  prenom: 'Awa',
  phoneE164: '+221770000009',
  phase2Status: 'METHOD_OBTAINED',
  lastCallOutcome: 'METHOD_OBTAINED',
  lastCallAt: '2026-08-17T10:30:00.000Z',
  lastCallById: 'u-1',
  lastCallByName: 'Fatou Sow',
});

const REPRESENTANT = rep({ id: 'r-1' });

function page<T>(items: readonly T[], total = items.length): Paginated<T> {
  return { items: [...items], total, page: 1, pageSize: 100, pageCount: 1 };
}

async function renderView(
  options: { projet?: 'CHUES' | 'GRAND_PUBLIC'; canFilter?: boolean; userId?: string } = {},
) {
  const view = renderWithQuery(
    <MesContactsView
      projet={options.projet ?? 'CHUES'}
      userId={options.userId ?? 'u-1'}
      canFilter={options.canFilter ?? false}
    />,
  );
  await screen.findByRole('heading', { name: 'Mes contacts' });
  return view;
}

beforeEach(() => {
  fetchRepresentantsAppeles.mockReset();
  fetchProspectsAppeles.mockReset();
  fetchUsers.mockReset();
  fetchRepresentantsAppeles.mockResolvedValue(page([REPRESENTANT]));
  fetchProspectsAppeles.mockResolvedValue(page([PROSPECT]));
  fetchUsers.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 200, pageCount: 1 });
});

describe('MesContactsView', () => {
  it('ouvre sur les prospects appelés, avec l’issue et le statut de la fiche', async () => {
    await renderView();

    const ligne = (await screen.findByText('Awa Diouf')).closest('tr') as HTMLElement;
    expect(within(ligne).getByText('+221 77 000 00 09')).toBeTruthy();
    expect(within(ligne).getAllByText('Méthode obtenue')).toHaveLength(2);
    expect(within(ligne).getByRole('link', { name: 'Awa Diouf' }).getAttribute('href')).toBe(
      '/chues/prospects?search=%2B221770000009',
    );
    expect(fetchProspectsAppeles).toHaveBeenCalledWith('u-1', 'CHUES');
  });

  it('bascule sur l’onglet des représentants et montre l’issue de leur dernier appel', async () => {
    await renderView();
    await screen.findByText('Awa Diouf');

    await userEvent.click(screen.getByRole('button', { name: 'Représentants' }));

    const ligne = (await screen.findByText('Aminata Ndiaye')).closest('tr') as HTMLElement;
    // L'issue en colonne, et la pastille qui la reprend faute de statut.
    expect(within(ligne).getAllByText('Prospects promis')).toHaveLength(2);
    expect(within(ligne).queryByText('A accepté')).toBeNull();
    expect(within(ligne).getByRole('link', { name: 'Aminata Ndiaye' }).getAttribute('href')).toBe(
      '/chues/representants/r-1',
    );
    expect(fetchRepresentantsAppeles).toHaveBeenCalledWith('u-1');
  });

  it('borne un téléconseiller à ses propres appels, sans lui offrir le filtre', async () => {
    await renderView({ userId: 'u-7' });

    await waitFor(() => {
      expect(fetchProspectsAppeles).toHaveBeenCalledWith('u-7', 'CHUES');
    });
    expect(screen.queryByLabelText('Appelé par')).toBeNull();
    expect(fetchUsers).not.toHaveBeenCalled();
  });

  it('part des appels de l’encadrant, puis suit le téléconseiller choisi', async () => {
    fetchUsers.mockResolvedValue({
      items: [{ id: 'u-2', fullName: 'Awa Ba', isActive: true }],
      total: 1,
      page: 1,
      pageSize: 200,
      pageCount: 1,
    });
    await renderView({ canFilter: true, userId: 'u-9' });

    expect(fetchProspectsAppeles).toHaveBeenCalledWith('u-9', 'CHUES');

    await userEvent.click(await screen.findByRole('combobox'));
    await userEvent.click(await screen.findByRole('option', { name: /Awa Ba/u }));

    await waitFor(() => {
      expect(fetchProspectsAppeles).toHaveBeenLastCalledWith('u-2', 'CHUES');
    });
  });

  it('ne propose aucun onglet en Grand Public et mène à la fiche du prospect', async () => {
    await renderView({ projet: 'GRAND_PUBLIC' });

    expect(await screen.findByRole('link', { name: 'Awa Diouf' })).toHaveProperty(
      'pathname',
      '/grand-public/p-1',
    );
    expect(screen.queryByRole('group', { name: 'Type de contact' })).toBeNull();
    expect(fetchProspectsAppeles).toHaveBeenCalledWith('u-1', 'GRAND_PUBLIC');
    expect(fetchRepresentantsAppeles).not.toHaveBeenCalled();
  });

  it('avoue que la liste est coupée quand le serveur en a davantage', async () => {
    fetchProspectsAppeles.mockResolvedValue(page([PROSPECT], 240));
    await renderView();

    expect(
      await screen.findByText(/240 au total, les 100 plus récents sont affichés/u),
    ).toBeTruthy();
  });

  it('dit quoi attendre quand aucun appel n’a encore été consigné', async () => {
    fetchProspectsAppeles.mockResolvedValue(page([]));
    await renderView();

    expect(await screen.findByText('Aucun appel enregistré')).toBeTruthy();
  });
});
