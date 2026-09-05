import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';

import { UserMenu } from '@/components/layout/user-menu';
import type * as OuverturesData from '@/lib/data/ouvertures';
import { renderWithQuery } from '@/test/render-query';
import { resetRouterMock, routerMock } from '@/test/router-mock';
import type { SessionUser } from '@/lib/types';
import { useVerrouNavigation } from '@/lib/use-verrou-navigation';

const toastError = vi.fn();
const fetchOuvertureCourante = vi.fn();

vi.mock('@/lib/data/ouvertures', async (importOriginal) => {
  const actual = await importOriginal<typeof OuverturesData>();
  return { ...actual, fetchOuvertureCourante: () => fetchOuvertureCourante() as unknown };
});

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

/** Ce que le serveur répond quand la fiche est encore en main, EB-08. */
const ouverture = (over: Partial<OuverturesData.OuvertureFiche> = {}) => ({
  id: 'ouv-1',
  openedById: 'user-1',
  openedByName: 'Awa Fixture',
  representantId: null,
  prospectId: 'p-1',
  ficheNom: 'Neuve Fiche',
  openedAt: new Date().toISOString(),
  closedAt: null,
  dureeSecondes: null,
  closingAttemptId: null,
  draft: null,
  releasedByName: null,
  releasedAt: null,
  ...over,
});

beforeEach(() => {
  resetRouterMock();
  toastError.mockClear();
  vi.restoreAllMocks();
  fetchOuvertureCourante.mockReset();
  fetchOuvertureCourante.mockResolvedValue(null);
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
  const appel = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(null, { status: 200 }));
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
  const appel = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(null, { status: 200 }));
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

// EB-08 : hors des consoles, `ficheTenue()` ne sait rien. Un rechargement sur
// une page tierce rendait la déconnexion possible, fiche verrouillée.
it('refuse la déconnexion depuis une page tierce, fiche tenue sur le serveur', async () => {
  const interaction = userEvent.setup();
  const appel = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue(new Response(null, { status: 200 }));
  fetchOuvertureCourante.mockResolvedValue(ouverture());
  renderWithQuery(<UserMenu user={user} />);

  await ouvrirLeMenu(interaction);
  await interaction.click(await screen.findByRole('menuitem', { name: 'Se déconnecter' }));

  expect(toastError).toHaveBeenCalledWith(
    'Vous avez une fiche en main. Qualifiez-la, ou demandez à un superviseur de la libérer.',
  );
  expect(appel).not.toHaveBeenCalled();
  expect(routerMock.replace).not.toHaveBeenCalled();
});

it('mène à la fiche tenue plutôt que de laisser chercher', async () => {
  const interaction = userEvent.setup();
  fetchOuvertureCourante.mockResolvedValue(ouverture({ ficheNom: 'Neuve Fiche' }));
  renderWithQuery(<UserMenu user={user} />);

  await ouvrirLeMenu(interaction);

  const reprise = await screen.findByRole('menuitem', {
    name: 'Reprendre la fiche de Neuve Fiche',
  });
  expect(reprise.getAttribute('href')).toBe('/chues/console');
});

it('mène au script quand la fiche tenue est un représentant', async () => {
  const interaction = userEvent.setup();
  fetchOuvertureCourante.mockResolvedValue(
    ouverture({ prospectId: null, representantId: 'r-1', ficheNom: 'Aminata Ndiaye' }),
  );
  renderWithQuery(<UserMenu user={user} />);

  await ouvrirLeMenu(interaction);

  const reprise = await screen.findByRole('menuitem', {
    name: 'Reprendre la fiche de Aminata Ndiaye',
  });
  expect(reprise.getAttribute('href')).toBe('/chues/appels-representants');
});

// Ni la banque ni l'accueil ne peuvent ouvrir une fiche : leur demander la
// sienne à chaque chargement de page serait une requête pour rien.
it('ne demande pas d’ouverture aux rôles qui n’en tiennent jamais', async () => {
  renderWithQuery(<UserMenu user={{ ...user, role: 'BANQUE_FINANCE' } as SessionUser} />);

  await screen.findByRole('button', { name: 'Compte de Awa Fixture' });

  expect(fetchOuvertureCourante).not.toHaveBeenCalled();
});
