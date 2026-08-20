import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { currentPathname, currentSearchParams, routerMock } from '@/test/router-mock';

const guardRoles = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`REDIRECT ${path}`);
  }),
);

vi.mock('next/navigation', () => ({
  useRouter: () => routerMock,
  usePathname: () => currentPathname(),
  useSearchParams: () => currentSearchParams(),
  redirect,
  unstable_rethrow: () => undefined,
}));

vi.mock('@/lib/session', () => ({ guardRoles }));

const SuggestionsPage = (await import('@/app/(panel)/suggestions/page')).default;

beforeEach(() => {
  guardRoles.mockReset();
  redirect.mockClear();
});

describe('garde des numéros suggérés', () => {
  it('renvoie un visiteur sans session vers la connexion', async () => {
    guardRoles.mockResolvedValue({ status: 'anonymous' });

    await expect(SuggestionsPage()).rejects.toThrow('REDIRECT /connexion');
  });

  it('refuse un agent bancaire au lieu de lui servir les numéros', async () => {
    guardRoles.mockResolvedValue({
      status: 'denied',
      user: { id: 'u-1', role: 'BANQUE_FINANCE' },
    });

    render(await SuggestionsPage());

    expect(screen.getByRole('alert').textContent).toContain('Accès refusé');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('n’ouvre l’écran qu’aux rôles qui suivent le terrain', async () => {
    guardRoles.mockResolvedValue({ status: 'anonymous' });

    await SuggestionsPage().catch(() => undefined);

    expect(guardRoles).toHaveBeenCalledWith(['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION']);
  });
});
