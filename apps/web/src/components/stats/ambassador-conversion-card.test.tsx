import { ApiError } from '@crm/api-client/query';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AmbassadorConversionCard } from '@/components/stats/ambassador-conversion-card';
import type * as StatsModule from '@/lib/data/advanced-stats';
import { renderWithQuery } from '@/test/render-query';

vi.mock('@/lib/data/advanced-stats', async () => {
  const actual = await vi.importActual<typeof StatsModule>('@/lib/data/advanced-stats');
  return { ...actual, fetchAmbassadorConversion: fetchMock };
});

const fetchMock = vi.hoisted(() => vi.fn());

describe('la carte de conversion en ambassadeurs', () => {
  it('dit sur quelle population le taux porte, et ce qui en est exclu', async () => {
    fetchMock.mockResolvedValue({
      contacted: 40,
      ambassadors: 10,
      conversionRate: 25,
      reverted: 0,
      untracked: 460,
    });

    renderWithQuery(<AmbassadorConversionCard />);

    await waitFor(() => {
      expect(screen.getByText('25 %')).toBeTruthy();
    });
    expect(screen.getByText(/10 ambassadeurs sur 40 représentants travaillés/u)).toBeTruthy();
    expect(screen.getByText(/460 représentants de l’annuaire n’ont aucune trace/u)).toBeTruthy();
  });

  it('se tait sur l’annuaire quand tout l’annuaire a été travaillé', async () => {
    fetchMock.mockResolvedValue({
      contacted: 40,
      ambassadors: 10,
      conversionRate: 25,
      reverted: 0,
      untracked: 0,
    });

    renderWithQuery(<AmbassadorConversionCard />);

    await waitFor(() => {
      expect(screen.getByText('25 %')).toBeTruthy();
    });
    expect(screen.queryByText(/aucune trace de relation/u)).toBeNull();
  });

  it('signale les ambassadeurs revenus en arrière, sans les retirer du chiffre', async () => {
    fetchMock.mockResolvedValue({
      contacted: 10,
      ambassadors: 4,
      conversionRate: 40,
      reverted: 4,
      untracked: 0,
    });

    renderWithQuery(<AmbassadorConversionCard />);

    await waitFor(() => {
      expect(screen.getByText('40 %')).toBeTruthy();
    });
    expect(screen.getByText(/4 d’entre eux ne sont plus ambassadeurs/u)).toBeTruthy();
  });

  it('aucune relation renseignée : dit quoi faire, n’affiche pas 0 %', async () => {
    fetchMock.mockResolvedValue({
      contacted: 0,
      ambassadors: 0,
      conversionRate: null,
      reverted: 0,
      untracked: 12,
    });

    renderWithQuery(<AmbassadorConversionCard />);

    await waitFor(() => {
      expect(screen.getByText(/Aucune relation renseignée sur la période/u)).toBeTruthy();
    });
    expect(screen.queryByText('0 %')).toBeNull();
  });

  it('un calcul en échec offre de réessayer, au lieu d’un squelette figé', async () => {
    fetchMock.mockRejectedValue(
      new ApiError({ message: 'Panne' }, new Response(null, { status: 500 })),
    );

    renderWithQuery(<AmbassadorConversionCard />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Réessayer/u })).toBeTruthy();
    });
    expect(screen.queryByText(/ambassadeurs sur/u)).toBeNull();
  });
});
