import { ApiError } from '@crm/api-client/query';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { BankAgingCard } from '@/components/stats/bank-aging-card';
import type * as StatsModule from '@/lib/data/advanced-stats';
import { renderWithQuery } from '@/test/render-query';

vi.mock('@/lib/data/advanced-stats', async () => {
  const actual = await vi.importActual<typeof StatsModule>('@/lib/data/advanced-stats');
  return { ...actual, fetchBankAging: fetchMock };
});

const fetchMock = vi.hoisted(() => vi.fn());

describe('la carte d’ancienneté face à une requête en échec', () => {
  it('n’annonce PAS un calcul en cours quand le calcul a échoué', async () => {
    fetchMock.mockRejectedValue(
      new ApiError({ message: 'Panne' }, new Response(null, { status: 500 })),
    );

    renderWithQuery(<BankAgingCard />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
    expect(screen.queryByText(/Calcul en cours/u)).toBeNull();
  });

  it('offre de réessayer, au lieu d’un squelette qui ne bouge plus', async () => {
    fetchMock.mockRejectedValue(
      new ApiError({ message: 'Panne' }, new Response(null, { status: 500 })),
    );

    renderWithQuery(<BankAgingCard />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Réessayer/u })).toBeTruthy();
    });
  });

  it('rend les chiffres, et aucune erreur, quand la requête aboutit', async () => {
    fetchMock.mockResolvedValue({
      total: 3,
      buckets: [{ bucket: '0-7', label: '0 à 7 jours', dossiers: 3, share: 1 }],
      stages: [
        { stageId: 's1', label: 'Vérification', dossiers: 3, share: 1, medianStationDays: 4 },
      ],
    });

    renderWithQuery(<BankAgingCard />);

    await waitFor(() => {
      expect(screen.getByText(/dossiers? encore ouvert/u)).toBeTruthy();
    });
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByText(/Calcul en cours/u)).toBeNull();
  });
});
