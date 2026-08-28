import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { currentPathname, currentSearchParams, routerMock } from '@/test/router-mock';

const guardRoles = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`REDIRECT ${path}`);
  }),
);
const prefetchQuery = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  usePathname: () => currentPathname(),
  useSearchParams: () => currentSearchParams(),
  redirect,
  unstable_rethrow: () => undefined,
}));

vi.mock('@/lib/session', () => ({ guardRoles }));

vi.mock('@/lib/query-client', () => ({
  getQueryClient: () => ({ prefetchQuery, getQueryData: () => undefined }),
}));

const AppelsRepresentantsPage = (await import('@/app/(panel)/chues/appels-representants/page'))
  .default;

beforeEach(() => {
  guardRoles.mockReset();
  redirect.mockClear();
  prefetchQuery.mockReset();
  prefetchQuery.mockResolvedValue(undefined);
});

describe('garde de l’étape 1, « Appeler les représentants »', () => {
  it('renvoie un visiteur sans session vers la connexion', async () => {
    guardRoles.mockResolvedValue({ status: 'anonymous' });

    await expect(AppelsRepresentantsPage()).rejects.toThrow('REDIRECT /connexion');
  });

  it('refuse la supervision au lieu de lui servir la file d’appel', async () => {
    guardRoles.mockResolvedValue({
      status: 'denied',
      user: { id: 'u-1', role: 'SUPERVISEUR' },
    });

    render(await AppelsRepresentantsPage());

    expect(screen.getByRole('alert').textContent).toContain('Accès refusé');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('n’ouvre l’écran qu’à ceux qui passent les appels', async () => {
    guardRoles.mockResolvedValue({ status: 'anonymous' });

    await AppelsRepresentantsPage().catch(() => undefined);

    expect(guardRoles).toHaveBeenCalledWith(['ADMIN', 'COMMERCIAL']);
  });
});
