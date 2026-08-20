import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as SuggestionsModule from '@/lib/data/suggestions';
import { renderWithQuery } from '@/test/render-query';

const fetchSuggestions = vi.hoisted(() => vi.fn());
const setStatus = vi.hoisted(() => vi.fn());

vi.mock('@/lib/data/suggestions', async () => {
  const actual = await vi.importActual<typeof SuggestionsModule>('@/lib/data/suggestions');
  return {
    ...actual,
    fetchSuggestions: (status: unknown) => fetchSuggestions(status) as unknown,
    setSuggestionStatus: (id: unknown, next: unknown) => setStatus(id, next) as unknown,
  };
});

const { SuggestionsView } = await import('@/components/suggestions/suggestions-view');

const suggestion = (over: Partial<SuggestionsModule.Suggestion> = {}) => ({
  id: 's-1',
  sourceRepresentantId: 'rep-9',
  sourceRepresentantShortCode: 'K4M2P7',
  suggestedName: 'Ousmane Ba',
  suggestedPhoneE164: '+221771111111',
  note: null,
  status: 'A_APPELER',
  suggestedById: 'u-1',
  suggestedByName: 'Aminata Diallo',
  resolvedRepresentantId: null,
  clientCreatedAt: '2026-05-02T09:00:00.000Z',
  createdAt: '2026-05-02T09:00:00.000Z',
  ...over,
});

const page = (items: unknown[], total = items.length) => ({
  items,
  total,
  page: 1,
  pageSize: 100,
  pageCount: Math.max(1, Math.ceil(total / 100)),
});

beforeEach(() => {
  fetchSuggestions.mockResolvedValue(page([suggestion()]));
  setStatus.mockResolvedValue(suggestion({ status: 'APPELE' }));
});

describe('SuggestionsView', () => {
  it('désigne la source par son code court, jamais par son nom', async () => {
    renderWithQuery(<SuggestionsView />);

    expect(await screen.findByText('K4M2P7')).toBeTruthy();
    expect(screen.getByText(/Aminata Diallo/u)).toBeTruthy();
  });

  it('remonte les « à appeler » au-dessus de ce qui est déjà tranché', async () => {
    fetchSuggestions.mockResolvedValue(
      page([
        suggestion({
          id: 's-1',
          status: 'ABANDONNE',
          suggestedPhoneE164: '+221770000001',
          clientCreatedAt: '2026-05-09T09:00:00.000Z',
        }),
        suggestion({
          id: 's-2',
          status: 'A_APPELER',
          suggestedPhoneE164: '+221770000002',
          clientCreatedAt: '2026-05-01T09:00:00.000Z',
        }),
      ]),
    );
    renderWithQuery(<SuggestionsView />);

    const liste = await screen.findByRole('list', { name: /Numéros suggérés/u });
    const lignes = within(liste)
      .getAllByRole('listitem')
      .map((item) => item.textContent);

    expect(lignes[0]).toContain('77 000 00 02');
    expect(lignes[1]).toContain('77 000 00 01');
  });

  it('redemande la liste au serveur quand on filtre sur un statut', async () => {
    const user = userEvent.setup();
    renderWithQuery(<SuggestionsView />);
    await screen.findByText('K4M2P7');

    await user.click(screen.getByRole('button', { name: 'Abandonné' }));

    expect(fetchSuggestions).toHaveBeenLastCalledWith('ABANDONNE');
  });

  it('signale un numéro déjà couvert par une fiche, et y mène', async () => {
    fetchSuggestions.mockResolvedValue(page([suggestion({ resolvedRepresentantId: 'rep-42' })]));
    renderWithQuery(<SuggestionsView />);

    expect(await screen.findByText('Déjà une fiche')).toBeTruthy();
    const lien = screen.getByRole('link', { name: 'Ouvrir la fiche existante' });
    expect(lien.getAttribute('href')).toBe('/chues/representants/rep-42');
    expect(screen.queryByRole('button', { name: /Créer la fiche/u })).toBeNull();
  });

  it('met en avant un numéro que plusieurs représentants ont cité, en disant sur quoi il compte', async () => {
    fetchSuggestions.mockResolvedValue(
      page([
        suggestion({ id: 's-1', sourceRepresentantShortCode: 'AAA111' }),
        suggestion({ id: 's-2', sourceRepresentantShortCode: 'BBB222' }),
        suggestion({ id: 's-3', suggestedPhoneE164: '+221779999999' }),
      ]),
    );
    renderWithQuery(<SuggestionsView />);

    expect(await screen.findAllByText('2 fois dans cette liste')).toHaveLength(2);
  });

  it('avoue que la liste est coupée quand le serveur en a davantage', async () => {
    fetchSuggestions.mockResolvedValue(page([suggestion(), suggestion({ id: 's-2' })], 240));
    renderWithQuery(<SuggestionsView />);

    expect(
      await screen.findByText(/240 numéros au total, les 2 plus récents sont affichés/u),
    ).toBeTruthy();
  });

  it('ne parle pas de coupure quand la liste est entière', async () => {
    fetchSuggestions.mockResolvedValue(page([suggestion()]));
    renderWithQuery(<SuggestionsView />);
    await screen.findByText('K4M2P7');

    expect(screen.queryByText(/plus récents sont affichés/u)).toBeNull();
  });

  it('marque un numéro appelé', async () => {
    const user = userEvent.setup();
    renderWithQuery(<SuggestionsView />);
    await screen.findByText('K4M2P7');

    await user.click(screen.getByRole('button', { name: /Marquer appelé/u }));

    expect(setStatus).toHaveBeenCalledWith('s-1', 'APPELE');
  });

  it('n’offre aucun geste à un rôle en lecture seule', async () => {
    renderWithQuery(<SuggestionsView readOnly />);
    await screen.findByText('K4M2P7');

    expect(screen.queryByRole('button', { name: /Marquer appelé/u })).toBeNull();
    expect(screen.queryByRole('button', { name: /Abandonner/u })).toBeNull();
    expect(screen.queryByRole('button', { name: /Créer la fiche/u })).toBeNull();
  });

  it('dit quoi attendre quand aucun numéro n’a été suggéré', async () => {
    fetchSuggestions.mockResolvedValue(page([]));
    renderWithQuery(<SuggestionsView />);

    expect(await screen.findByText(/Aucun numéro suggéré/u)).toBeTruthy();
  });
});
