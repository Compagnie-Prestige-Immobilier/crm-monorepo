import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';

import { UserMenu } from '@/components/layout/user-menu';
import { renderWithQuery } from '@/test/render-query';
import { resetRouterMock, routerMock } from '@/test/router-mock';
import type { SessionUser } from '@/lib/types';

const user = {
  id: 'user-1',
  fullName: 'Awa Fixture',
  email: 'fixture.awa@cpi.sn',
  role: 'COMMERCIAL',
  workspace: 'demo',
} as SessionUser;

beforeEach(() => {
  resetRouterMock();
  vi.restoreAllMocks();
});

it('quitte le mode démo et revient au choix des espaces', async () => {
  const interaction = userEvent.setup();
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 200 }));
  renderWithQuery(<UserMenu user={user} demoEnabled />);

  await interaction.click(screen.getByRole('button', { name: 'Compte de Awa Fixture' }));
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

it('ne propose aucune bascule quand l’espace démo est fermé', async () => {
  const interaction = userEvent.setup();
  renderWithQuery(<UserMenu user={user} demoEnabled={false} />);

  await interaction.click(screen.getByRole('button', { name: 'Compte de Awa Fixture' }));

  await screen.findByRole('menuitem', { name: 'Se déconnecter' });
  expect(screen.queryByRole('menuitem', { name: /espace démo/u })).toBeNull();
});
