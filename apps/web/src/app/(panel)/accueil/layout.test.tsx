import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const guardRoles = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() =>
  vi.fn((path: string) => {
    throw new Error(`REDIRECT ${path}`);
  }),
);

vi.mock('next/navigation', () => ({ redirect }));
vi.mock('@/lib/session', () => ({ guardRoles }));

const AccueilLayout = (await import('@/app/(panel)/accueil/layout')).default;

const render_ = async () => render(await AccueilLayout({ children: <p>registre</p> }));

beforeEach(() => {
  guardRoles.mockReset();
  redirect.mockClear();
});

describe('garde du registre des visites', () => {
  it('renvoie un visiteur sans session vers la connexion', async () => {
    guardRoles.mockResolvedValue({ status: 'anonymous' });

    await expect(render_()).rejects.toThrow('REDIRECT /connexion');
  });

  it('n’ouvre le registre qu’au comptoir, à la direction et à l’ADMIN', async () => {
    guardRoles.mockResolvedValue({ status: 'anonymous' });

    await render_().catch(() => undefined);

    expect(guardRoles).toHaveBeenCalledWith(['ADMIN', 'DIRECTION', 'ACCUEIL']);
  });

  it('refuse un autre rôle au lieu de lui servir le registre', async () => {
    guardRoles.mockResolvedValue({ status: 'denied', user: { id: 'u-1', role: 'SUPERVISEUR' } });

    await render_();

    expect(screen.getByRole('alert').textContent).toContain('Accès refusé');
    expect(screen.queryByText('registre')).toBeNull();
    expect(redirect).not.toHaveBeenCalled();
  });

  it('mène au tableau de bord des visites, seul chemin vers lui', async () => {
    guardRoles.mockResolvedValue({ status: 'allowed', user: { id: 'u-1', role: 'ADMIN' } });

    await render_();

    expect(screen.getByRole('link', { name: 'Tableau de bord' }).getAttribute('href')).toBe(
      '/accueil/tableau-de-bord',
    );
    expect(screen.getByText('registre')).toBeTruthy();
  });
});
