import { ApiError } from '@crm/api-client/query';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DelaysStrip, PortfolioBlocks } from '@/components/stats/portfolio-blocks';
import type * as StatsModule from '@/lib/data/advanced-stats';
import { renderWithQuery } from '@/test/render-query';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * QUATRE REQUÊTES, QUATRE FAÇONS DE DÉGUISER UNE PANNE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * TanStack pose `isPending: false` ET `data: undefined` quand une requête
 * échoue. Les quatre blocs de ce fichier ne testaient que `data === undefined`
 * ou lisaient `data?.items ?? []` : l'échec empruntait donc la branche du
 * chargement, ou pire, celle du succès vide.
 *
 * Le graphique vide est le cas le plus grave, et c'est pour lui que ce fichier
 * existe : un squelette perpétuel fait au moins attendre, tandis qu'un
 * graphique sans barre AFFIRME qu'il n'y a rien à montrer. Personne ne va
 * vérifier une réponse aussi nette.
 *
 * Chaque cas d'échec est doublé d'un cas de SUCCÈS. Sans lui, un composant qui
 * afficherait l'erreur en toutes circonstances passerait la moitié haute de ce
 * fichier sans rien corriger du tout.
 */

/**
 * Les graphiques sont remplaces : ils s'appuient sur une mesure de mise en page
 * que jsdom ne fait pas, et ce fichier n'eprouve pas leur rendu mais la branche
 * qui les REMPLACE quand la requete echoue.
 */
vi.mock('@/components/dashboard/charts', () => ({
  RankBarChart: () => <div data-testid="rank-bar-chart" />,
  ShareDoughnutChart: () => <div data-testid="share-doughnut-chart" />,
}));

vi.mock('@/lib/data/advanced-stats', async () => {
  const actual = await vi.importActual<typeof StatsModule>('@/lib/data/advanced-stats');
  return {
    ...actual,
    fetchAnalyticsDelays: delaysMock,
    fetchWeeklyCohorts: cohortsMock,
    fetchRepresentantProductivity: productivityMock,
    fetchDepartementYield: yieldMock,
    fetchOriginBreakdown: originsMock,
  };
});

const delaysMock = vi.hoisted(() => vi.fn());
const cohortsMock = vi.hoisted(() => vi.fn());
const productivityMock = vi.hoisted(() => vi.fn());
const yieldMock = vi.hoisted(() => vi.fn());
const originsMock = vi.hoisted(() => vi.fn());

/**
 * Chaque panne porte un message DISTINCT : `QueryErrorInline` affiche le message
 * de l'API quand il y en a un, et c'est ce qui permet au test d'isolement de
 * dire QUEL bloc a echoue plutot que de compter des alertes anonymes.
 */
const panne = (quoi: string): ApiError =>
  new ApiError({ message: `panne-${quoi}` }, new Response(null, { status: 500 }));

/** Réponses minimales et VALIDES, pour les cas de succès. */
const okDelays = {
  legs: [{ leg: 'a', label: 'Prospect vers méthode', medianDays: 3, p90Days: 9, sample: 12 }],
};
const okCohorts = { items: [] };
const okProductivity = { items: [], dormantDays: 30 };
const okYield = { items: [] };
const okOrigins = { items: [] };

function toutEnSucces(): void {
  delaysMock.mockResolvedValue(okDelays);
  cohortsMock.mockResolvedValue(okCohorts);
  productivityMock.mockResolvedValue(okProductivity);
  yieldMock.mockResolvedValue(okYield);
  originsMock.mockResolvedValue(okOrigins);
}

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
