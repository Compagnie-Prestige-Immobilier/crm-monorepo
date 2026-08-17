import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as DemoModule from '@/lib/data/demo';
import { renderWithQuery } from '@/test/render-query';

const COUNTS = {
  users: 0,
  representants: 0,
  prospects: 0,
  campaigns: 0,
  campaignCommerciaux: 0,
  callTasks: 0,
  callAttempts: 0,
  bankCases: 0,
  bankCaseTransitions: 0,
};

const enableDemoMode = vi.fn(() =>
  Promise.resolve({ enabled: true, seededAt: null, counts: { ...COUNTS, prospects: 1200 } }),
);
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
  counts: COUNTS,
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

    expect(await screen.findByText(/ne seront plus des chiffres réels/)).toBeTruthy();
    expect(screen.getByText(/Réversible/)).toBeTruthy();
  });

  it('annonce que TOUTE la plateforme passe en lecture seule, pour tous', async () => {
    renderWithQuery(<DemoModeCard />);

    await userEvent.click(
      await screen.findByRole('button', { name: /Activer le mode démonstration/ }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toMatch(/lecture seule/u);
    expect(dialog.textContent).toMatch(/tous les utilisateurs/u);
  });

  it('nomme ce qui continue de fonctionner malgré la lecture seule', async () => {
    renderWithQuery(<DemoModeCard />);

    await userEvent.click(
      await screen.findByRole('button', { name: /Activer le mode démonstration/ }),
    );

    const text = (await screen.findByRole('dialog')).textContent;
    expect(text).toMatch(/se connecter/u);
    expect(text).toMatch(/rebasculer ce réglage/u);
    expect(text).toMatch(/synchronisation mobile/u);
    expect(text).toMatch(/notification comme lue/u);
  });

  it('affirme que les saisies du terrain sont réelles et survivent', async () => {
    renderWithQuery(<DemoModeCard />);

    await userEvent.click(
      await screen.findByRole('button', { name: /Activer le mode démonstration/ }),
    );

    const text = (await screen.findByRole('dialog')).textContent;
    expect(text).toMatch(/données réelles/u);
    expect(text).toMatch(/restent en place une fois le mode désactivé/u);
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
