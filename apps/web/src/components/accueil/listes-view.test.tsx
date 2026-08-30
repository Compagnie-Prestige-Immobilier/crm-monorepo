import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithQuery } from '@/test/render-query';
import { routerMock, setUrl } from '@/test/router-mock';
import type { VisiteReferentielEntry } from '@/lib/data/visites-referentiels';
import type * as VisitesReferentielsModule from '@/lib/data/visites-referentiels';

const fetchVisiteReferentielList = vi.fn();
const fetchVisiteReferentielUsage = vi.fn();
const createVisiteReferentiel = vi.fn();
const updateVisiteReferentiel = vi.fn();
const setVisiteReferentielActive = vi.fn();
const reorderVisiteReferentiel = vi.fn();

vi.mock('@/lib/data/visites-referentiels', async () => {
  const actual = await vi.importActual<typeof VisitesReferentielsModule>(
    '@/lib/data/visites-referentiels',
  );
  return {
    ...actual,
    fetchVisiteReferentielList: (kind: unknown) => fetchVisiteReferentielList(kind) as unknown,
    fetchVisiteReferentielUsage: () => fetchVisiteReferentielUsage() as unknown,
    createVisiteReferentiel: (kind: unknown, input: unknown) =>
      createVisiteReferentiel(kind, input) as unknown,
    updateVisiteReferentiel: (kind: unknown, id: unknown, patch: unknown) =>
      updateVisiteReferentiel(kind, id, patch) as unknown,
    setVisiteReferentielActive: (kind: unknown, id: unknown, isActive: unknown) =>
      setVisiteReferentielActive(kind, id, isActive) as unknown,
    reorderVisiteReferentiel: (kind: unknown, ids: unknown) =>
      reorderVisiteReferentiel(kind, ids) as unknown,
  };
});

const { ListesView } = await import('@/components/accueil/listes-view');

const entry = (patch: Partial<VisiteReferentielEntry>): VisiteReferentielEntry => ({
  id: 'e-1',
  code: 'CPI',
  label: 'CPI',
  isActive: true,
  isSystem: false,
  sortOrder: 1,
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...patch,
});

const CPI = entry({ id: 'e-1', code: 'CPI', label: 'CPI', sortOrder: 1, isSystem: true });
const SANTARGILE = entry({ id: 'e-2', code: 'SANTARGILE', label: 'SANTARGILE', sortOrder: 2 });

beforeEach(() => {
  setUrl('/accueil/listes');
  fetchVisiteReferentielList.mockReset();
  fetchVisiteReferentielList.mockImplementation((kind: string) =>
    Promise.resolve(kind === 'entreprises' ? [CPI, SANTARGILE] : []),
  );
  fetchVisiteReferentielUsage.mockReset();
  fetchVisiteReferentielUsage.mockResolvedValue({
    entreprises: { 'e-1': 12, 'e-2': 0 },
    directions: {},
    destinataires: {},
    objets: {},
  });
  createVisiteReferentiel.mockReset();
  updateVisiteReferentiel.mockReset();
  setVisiteReferentielActive.mockReset();
  reorderVisiteReferentiel.mockReset();
  reorderVisiteReferentiel.mockResolvedValue([SANTARGILE, CPI]);
  setVisiteReferentielActive.mockResolvedValue({ ...SANTARGILE, isActive: false });
});

describe('listes du registre des visites', () => {
  it('montre les quatre onglets, entreprises en premier', async () => {
    renderWithQuery(<ListesView />);

    await screen.findByText('CPI');
    for (const label of ['Entreprises', 'Directions', 'Destinataires', 'Objets de visite']) {
      expect(screen.getByRole('tab', { name: label })).toBeTruthy();
    }
  });

  it('marque l’origine « classeur » sans empêcher sa désactivation', async () => {
    renderWithQuery(<ListesView />);

    const ligne = (await screen.findByText('CPI')).closest('li');
    expect(ligne).not.toBeNull();
    expect(within(ligne as HTMLElement).getByText('Classeur d’origine')).toBeTruthy();
    expect(
      within(ligne as HTMLElement).getByRole('button', { name: 'Désactiver CPI' }),
    ).toBeTruthy();
  });

  it('porte la recherche dans l’URL', async () => {
    renderWithQuery(<ListesView />);
    await screen.findByText('CPI');

    await userEvent.type(screen.getByLabelText('Rechercher'), 'x');

    await vi.waitFor(() => {
      expect(routerMock.replace).toHaveBeenCalledWith('/accueil/listes?recherche=x', {
        scroll: false,
      });
    });
  });

  it('filtre en mémoire par libellé ou code', async () => {
    setUrl('/accueil/listes?recherche=santa');
    renderWithQuery(<ListesView />);

    expect(await screen.findByText('SANTARGILE')).toBeTruthy();
    expect(screen.queryByText('CPI')).toBeNull();
  });

  it('envoie la liste complète réordonnée, dans le nouvel ordre, au clic sur Descendre', async () => {
    renderWithQuery(<ListesView />);
    await screen.findByText('CPI');

    await userEvent.click(screen.getByRole('button', { name: 'Descendre CPI' }));

    expect(reorderVisiteReferentiel).toHaveBeenCalledWith('entreprises', ['e-2', 'e-1']);
  });

  it('ne propose pas de faire monter la première entrée ni de descendre la dernière', async () => {
    renderWithQuery(<ListesView />);
    await screen.findByText('CPI');

    expect(screen.getByRole('button', { name: 'Monter CPI' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Descendre SANTARGILE' })).toHaveProperty(
      'disabled',
      true,
    );
  });

  it('affiche le nombre de visites de chaque entrée', async () => {
    renderWithQuery(<ListesView />);

    const ligne = (await screen.findByText('CPI')).closest('li');
    expect(ligne?.textContent).toContain('12 visites');
  });

  it('ouvre la boîte de désactivation qui compte des visites, pas des prospects', async () => {
    renderWithQuery(<ListesView />);
    await screen.findByText('SANTARGILE');

    await userEvent.click(screen.getByRole('button', { name: 'Désactiver SANTARGILE' }));

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('dialog').textContent).toContain('0 visite référence');

    await userEvent.click(screen.getByRole('button', { name: 'Désactiver' }));
    expect(setVisiteReferentielActive).toHaveBeenCalledWith('entreprises', 'e-2', false);
  });

  it('crée une entrée avec son code en majuscules', async () => {
    createVisiteReferentiel.mockResolvedValue(entry({ id: 'e-3', code: 'NEUVE', label: 'Neuve' }));
    renderWithQuery(<ListesView />);
    await screen.findByText('CPI');

    await userEvent.click(screen.getByRole('button', { name: 'Nouvelle entreprise' }));
    await userEvent.type(screen.getByLabelText(/^Code/), 'neuve');
    await userEvent.type(screen.getByLabelText(/^Libellé/), 'Neuve');
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));

    await vi.waitFor(() => {
      expect(createVisiteReferentiel).toHaveBeenCalledWith(
        'entreprises',
        expect.objectContaining({ code: 'NEUVE', label: 'Neuve' }),
      );
    });
  });

  it('dit quoi faire ensuite quand la liste est vide', async () => {
    fetchVisiteReferentielList.mockResolvedValue([]);
    renderWithQuery(<ListesView />);

    expect(await screen.findByText('Aucune entreprise enregistrée.')).toBeTruthy();
  });
});
