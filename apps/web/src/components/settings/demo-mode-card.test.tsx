import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as DemoModule from '@/lib/data/demo';
import { renderWithQuery } from '@/test/render-query';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * L'ACTIVATION doit se confirmer, elle aussi.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'asymétrie corrigée était à l'envers : retirer le jeu de démonstration
 * exigeait une case à cocher, l'installer partait au PREMIER CLIC. C'est
 * pourtant l'activation qui pollue les chiffres de tout le monde, puisqu'elle
 * ensemence des milliers de lignes crédibles qui apparaissent aussitôt dans les
 * tableaux de bord, les statistiques et les exports de chaque rôle.
 *
 * Le test le plus important est donc le premier : cliquer « Activer » ne doit
 * RIEN ensemencer. Une régression ici est invisible à la relecture (le bouton a
 * exactement la même allure) et coûteuse en production.
 */

const enableDemoMode = vi.fn(() => Promise.resolve({ enabled: true, seededAt: null, counts: {} }));
const fetchDemoStatus = vi.fn();

vi.mock('@/lib/data/demo', async () => {
  const actual = await vi.importActual<typeof DemoModule>('@/lib/data/demo');
  return {
    ...actual,
    fetchDemoStatus: () => fetchDemoStatus() as unknown,
    enableDemoMode: () => enableDemoMode(),
    disableDemoMode: () => Promise.resolve({}),
  };
});

const { DemoModeCard } = await import('@/components/settings/demo-mode-card');

const IDLE_STATUS = {
  enabled: false,
  canToggle: true,
  reason: null,
  seededAt: null,
  counts: {
    users: 0,
    representants: 0,
    prospects: 0,
    campaigns: 0,
    bankCases: 0,
    callAttempts: 0,
  },
};

describe('DemoModeCard, activation', () => {
  beforeEach(() => {
    enableDemoMode.mockClear();
    fetchDemoStatus.mockReturnValue(Promise.resolve(IDLE_STATUS));
  });

  it('n’ensemence RIEN au premier clic : elle demande confirmation', async () => {
    renderWithQuery(<DemoModeCard />);

    await userEvent.click(
      await screen.findByRole('button', { name: /Activer le mode démonstration/ }),
    );

    expect(enableDemoMode).not.toHaveBeenCalled();
    expect(
      await screen.findByRole('heading', { name: /Créer le jeu de démonstration/ }),
    ).toBeTruthy();
  });

  it('nomme ce qui va être créé, plutôt que de promettre « un jeu »', async () => {
    renderWithQuery(<DemoModeCard />);

    await userEvent.click(
      await screen.findByRole('button', { name: /Activer le mode démonstration/ }),
    );

    // La conséquence qui décide du clic : les chiffres cessent d'être réels.
    expect(await screen.findByText(/ne seront plus des chiffres réels/)).toBeTruthy();
    // Et la contrepartie, sans laquelle personne n'ose : c'est réversible.
    expect(screen.getByText(/Réversible/)).toBeTruthy();
  });

  it('annuler la confirmation n’ensemence pas', async () => {
    renderWithQuery(<DemoModeCard />);

    await userEvent.click(
      await screen.findByRole('button', { name: /Activer le mode démonstration/ }),
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Annuler' }));

    expect(enableDemoMode).not.toHaveBeenCalled();
  });

  it('n’ensemence qu’une fois la confirmation validée', async () => {
    renderWithQuery(<DemoModeCard />);

    await userEvent.click(
      await screen.findByRole('button', { name: /Activer le mode démonstration/ }),
    );
    await userEvent.click(
      await screen.findByRole('button', { name: /Créer le jeu de démonstration/ }),
    );

    await waitFor(() => {
      expect(enableDemoMode).toHaveBeenCalledTimes(1);
    });
  });
});
