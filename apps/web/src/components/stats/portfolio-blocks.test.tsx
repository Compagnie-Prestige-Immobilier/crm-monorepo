import { ApiError } from '@crm/api-client/query';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DelaysStrip } from '@/components/stats/portfolio-blocks';
import type * as StatsModule from '@/lib/data/advanced-stats';
import { renderWithQuery } from '@/test/render-query';

vi.mock('@/lib/data/advanced-stats', async () => {
  const actual = await vi.importActual<typeof StatsModule>('@/lib/data/advanced-stats');
  return {
    ...actual,
    fetchAnalyticsDelays: delaysMock,
  };
});

const delaysMock = vi.hoisted(() => vi.fn());

const panne = (quoi: string): ApiError =>
  new ApiError({ message: `panne-${quoi}` }, new Response(null, { status: 500 }));

const okDelays = {
  legs: [{ leg: 'a', label: 'Prospect vers méthode', medianDays: 3, p90Days: 9, sample: 12 }],
};

describe('les délais face à une requête en échec', () => {
  it('nomme la panne au lieu de laisser trois squelettes', async () => {
    delaysMock.mockRejectedValue(panne('delais'));

    renderWithQuery(<DelaysStrip />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: /Réessayer/u })).toBeTruthy();
  });

  it('n’affiche AUCUNE erreur quand la requête aboutit', async () => {
    delaysMock.mockResolvedValue(okDelays);

    renderWithQuery(<DelaysStrip />);

    await waitFor(() => {
      expect(screen.getByText(/Prospect vers méthode/u)).toBeTruthy();
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
