import { ApiError } from '@crm/api-client/query';
import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DelaysStrip } from '@/components/stats/portfolio-blocks';
import type * as StatsModule from '@/lib/data/advanced-stats';
import { renderWithQuery } from '@/test/render-query';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * UN ÉCHEC NE DOIT PAS EMPRUNTER LA BRANCHE DU CHARGEMENT
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * TanStack pose `isPending: false` ET `data: undefined` quand une requête
 * échoue. `DelaysStrip` ne testait que `isPending || data === undefined` :
 * l'échec s'affichait donc en squelettes, indéfiniment, puisque plus rien ne
 * viendra les remplacer. Personne devant un squelette ne soupçonne une panne.
 *
 * Le cas d'échec est doublé d'un cas de SUCCÈS. Sans lui, un composant qui
 * afficherait l'erreur en toutes circonstances passerait le premier test sans
 * rien corriger du tout.
 *
 * Les quatre blocs de `PortfolioBlocks` ont reçu la même correction (une
 * branche d'erreur par requête, cf. `portfolio-blocks.tsx`). Ils ne sont pas
 * éprouvés ici : leur montage traverse des graphiques qui mesurent la mise en
 * page, ce que jsdom ne fait pas. Les couvrir demande un banc de rendu que ce
 * fichier n'a pas, et un test qu'on fait passer en neutralisant ce qu'il
 * traverse ne prouve plus grand-chose.
 */

vi.mock('@/lib/data/advanced-stats', async () => {
  const actual = await vi.importActual<typeof StatsModule>('@/lib/data/advanced-stats');
  return {
    ...actual,
    fetchAnalyticsDelays: delaysMock,
  };
});

const delaysMock = vi.hoisted(() => vi.fn());

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
