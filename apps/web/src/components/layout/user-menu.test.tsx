import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';

import { UserMenu } from '@/components/layout/user-menu';
import { renderWithQuery } from '@/test/render-query';
import { resetRouterMock, routerMock } from '@/test/router-mock';
import type { SessionUser } from '@/lib/types';
import { useVerrouNavigation } from '@/lib/use-verrou-navigation';

const toastError = vi.fn();

vi.mock('sonner', () => ({
  toast: {
    error: (message: string) => {
      toastError(message);
    },
    success: vi.fn(),
    info: vi.fn(),
  },
}));

const user = {
  id: 'user-1',
  fullName: 'Awa Fixture',
  email: 'fixture.awa@cpi.sn',
  role: 'COMMERCIAL',
  workspace: 'demo',
} as SessionUser;

/** Ce que le téléconseiller a sous les yeux quand une fiche est ouverte. */
function SousVerrou({ user: compte }: { user: SessionUser }): React.JSX.Element {
  useVerrouNavigation(true, vi.fn());
  return <UserMenu user={compte} />;
}

const ouvrirLeMenu = async (interaction: ReturnType<typeof userEvent.setup>): Promise<void> => {
  await interaction.click(screen.getByRole('button', { name: 'Compte de Awa Fixture' }));
};

beforeEach(() => {
  resetRouterMock();
  toastError.mockClear();
  vi.restoreAllMocks();
});

it('quitte le mode démo et revient au choix des espaces', async () => {
  const interaction = userEvent.setup();
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
  renderWithQuery(<UserMenu user={user} />);

  await ouvrirLeMenu(interaction);
  await interaction.click(await screen.findByRole('menuitem', { name: 'Quitter l’espace démo' }));

  await waitFor(() => {
    expect(fetch).toHaveBeenCalledWith('/api/auth/workspace', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspace: 'public' }),
    });
    expect(routerMock.refresh).toHaveBeenCalled();
  });
});

// EB-08 : la fiche tenue reste verrouillée sur le serveur. Se déconnecter la
// laisserait hors de vue, et seul un superviseur pourrait encore la libérer.
it('refuse la déconnexion tant qu’une fiche est en main', async () => {
  const interaction = userEvent.setup();
  const appel = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
  renderWithQuery(<SousVerrou user={user} />);

  await ouvrirLeMenu(interaction);
  await interaction.click(await screen.findByRole('menuitem', { name: 'Se déconnecter' }));

  expect(toastError).toHaveBeenCalledWith(
    'Vous avez une fiche en main. Qualifiez-la, ou demandez à un superviseur de la libérer.',
  );
  expect(appel).not.toHaveBeenCalled();
  expect(routerMock.replace).not.toHaveBeenCalled();
});

// Le changement d'espace laisse la fiche à l'écran, mais son ouverture reste
// dans l'espace quitté : la qualification n'aurait plus où atterrir.
it('refuse le changement d’espace tant qu’une fiche est en main', async () => {
  const interaction = userEvent.setup();
  const appel = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
  renderWithQuery(<SousVerrou user={user} />);

  await ouvrirLeMenu(interaction);
  await interaction.click(await screen.findByRole('menuitem', { name: 'Quitter l’espace démo' }));

  expect(toastError).toHaveBeenCalledWith(
    'Vous avez une fiche en main. Qualifiez-la, ou demandez à un superviseur de la libérer.',
  );
  expect(appel).not.toHaveBeenCalled();
});

it('déconnecte quand aucune fiche n’est en main', async () => {
  const interaction = userEvent.setup();
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
  renderWithQuery(<UserMenu user={user} />);

  await ouvrirLeMenu(interaction);
  await interaction.click(await screen.findByRole('menuitem', { name: 'Se déconnecter' }));

  await waitFor(() => {
    expect(routerMock.replace).toHaveBeenCalledWith('/connexion');
  });
  expect(toastError).not.toHaveBeenCalled();
});
