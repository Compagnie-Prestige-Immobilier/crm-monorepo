import { screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as RepresentantsModule from '@/lib/data/representants';
import { renderWithQuery } from '@/test/render-query';
import { setUrl } from '@/test/router-mock';

const fetchRepresentants = vi.fn();

vi.mock('@/lib/data/representants', async () => {
  const actual = await vi.importActual<typeof RepresentantsModule>('@/lib/data/representants');
  return { ...actual, fetchRepresentants: () => fetchRepresentants() as unknown };
});

vi.mock('@/lib/data/reference', () => ({
  fetchDepartements: () => Promise.resolve([]),
  fetchIefs: () => Promise.resolve([]),
  fetchBanques: () => Promise.resolve([]),
  fetchSyndicats: () => Promise.resolve([]),
  fetchRegions: () => Promise.resolve([]),
}));

const { RepresentantsView } = await import('@/components/representants/representants-view');

const EMPTY_PAGE = {
  items: [],
  meta: { total: 0, page: 1, pageSize: 25, pageCount: 0 },
};

const ONE_PAGE = {
  items: [
    {
      id: 'r-1',
      fullName: 'Ndeye Fall',
      phoneE164: '+221771234567',
      departementId: 'd-1',
      departementName: 'Dakar',
      iefId: null,
      iefName: null,
      createdById: 'u-1',
      createdByName: 'Aminata Diallo',
      prospectCount: 12,
      clientCreatedAt: '2026-03-01T09:00:00.000Z',
      notes: null,
      createdAt: '2026-03-01T09:00:00.000Z',
      updatedAt: '2026-03-01T09:00:00.000Z',
    },
  ],
  meta: { total: 1, page: 1, pageSize: 25, pageCount: 1 },
};

describe('RepresentantsView, état vide', () => {
  beforeEach(() => {
    fetchRepresentants.mockReturnValue(Promise.resolve(EMPTY_PAGE));
  });

  it('sans aucun critère, ne renvoie PAS retirer un filtre inexistant', async () => {
    setUrl('/representants');
    renderWithQuery(<RepresentantsView canAdminister />);

    expect(await screen.findByText('Aucun représentant enregistré.')).toBeTruthy();
    expect(screen.queryByText(/retirez un filtre/)).toBeNull();
  });

  it('sans aucun critère, dit d’où viennent les fiches', async () => {
    setUrl('/representants');
    renderWithQuery(<RepresentantsView canAdminister />);

    expect(await screen.findByText(/saisies en tournée depuis le mobile/)).toBeTruthy();
  });

  it('rend son état vide en dehors du tableau, pour qu’il survive au petit écran', async () => {
    setUrl('/representants');
    renderWithQuery(<RepresentantsView canAdminister />);

    const message = await screen.findByText('Aucun représentant enregistré.');
    expect(message.closest('table')).toBeNull();
  });

  it('avec un critère actif, invite bien à l’élargir', async () => {
    setUrl('/representants?search=Ndeye');
    renderWithQuery(<RepresentantsView canAdminister />);

    expect(
      await screen.findByText('Aucun représentant ne correspond à ces critères.'),
    ).toBeTruthy();
    expect(screen.getByText(/Élargissez la recherche ou retirez un filtre/)).toBeTruthy();
    expect(screen.queryByText('Aucun représentant enregistré.')).toBeNull();
  });

  it('ne propose l’import Excel qu’aux administrateurs', async () => {
    setUrl('/representants');
    renderWithQuery(<RepresentantsView canAdminister={false} />);

    expect(await screen.findByText('Aucun représentant enregistré.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Import Excel' })).toBeNull();
  });
});

describe('RepresentantsView, repli en carte', () => {
  beforeEach(() => {
    fetchRepresentants.mockReturnValue(Promise.resolve(ONE_PAGE));
  });

  it('rend chaque représentant DEUX fois : en ligne de tableau et en carte', async () => {
    setUrl('/representants');
    renderWithQuery(<RepresentantsView canAdminister />);

    const noms = await screen.findAllByText('Ndeye Fall');
    expect(noms).toHaveLength(2);
    expect(noms.filter((node) => node.closest('table') !== null)).toHaveLength(1);
    expect(noms.filter((node) => node.closest('table') === null)).toHaveLength(1);
  });

  it('la carte porte les mêmes champs que la ligne, sans en perdre un seul', async () => {
    setUrl('/representants');
    renderWithQuery(<RepresentantsView canAdminister />);

    await screen.findAllByText('Ndeye Fall');
    const carte = screen.getAllByRole('article')[0];
    if (carte === undefined) throw new Error('Aucune carte de représentant.');

    expect(within(carte).getByText('Dakar')).toBeTruthy();
    expect(within(carte).getByText('Aminata Diallo')).toBeTruthy();
    expect(within(carte).getByText('12')).toBeTruthy();
    expect(
      within(carte).getByRole('button', { name: /Modifier la fiche de Ndeye Fall/ }),
    ).toBeTruthy();
  });
});
