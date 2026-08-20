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

const RepresentantPage = (await import('@/app/(panel)/chues/representants/[id]/page')).default;

const params = Promise.resolve({ id: 'rep-1' });

beforeEach(() => {
  guardRoles.mockReset();
  redirect.mockClear();
});

describe('garde de la fiche représentant', () => {
  it('renvoie un visiteur sans session vers la connexion', async () => {
    guardRoles.mockResolvedValue({ status: 'anonymous' });

    await expect(RepresentantPage({ params })).rejects.toThrow('REDIRECT /connexion');
  });

  it('refuse un rôle hors périmètre au lieu de lui servir la fiche', async () => {
    guardRoles.mockResolvedValue({
      status: 'denied',
      user: { id: 'u-1', role: 'BANQUE_FINANCE' },
    });

    render(await RepresentantPage({ params }));

    expect(screen.getByRole('alert').textContent).toContain('Accès refusé');
    expect(redirect).not.toHaveBeenCalled();
  });

  it('n’ouvre la fiche qu’aux rôles qui suivent le terrain', async () => {
    guardRoles.mockResolvedValue({ status: 'anonymous' });

    await RepresentantPage({ params }).catch(() => undefined);

    expect(guardRoles).toHaveBeenCalledWith(['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION']);
  });
});
