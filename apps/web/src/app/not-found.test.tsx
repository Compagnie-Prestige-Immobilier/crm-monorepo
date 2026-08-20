import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { PANEL_ROLES } from '@/lib/data/auth';

const getSession = vi.fn();

vi.mock('@/lib/session', () => ({
  getSession: () => getSession() as unknown,
}));

const NotFound = (await import('@/app/not-found')).default;

const renderNotFound = async (): Promise<void> => {
  render(await NotFound());
};

describe('page introuvable', () => {
  // Sur PANEL_ROLES et non sur deux rôles choisis : aucun d'eux ne doit
  // atterrir sur un écran que son rôle ne peut pas ouvrir, et le hub est le
  // seul que tous peuvent ouvrir.
  it.each([...PANEL_ROLES])('renvoie un %s vers le hub des espaces', async (role) => {
    getSession.mockReturnValue(Promise.resolve({ id: 'u1', role }));
    await renderNotFound();

    expect(screen.getByRole('link', { name: /Revenir aux espaces/ }).getAttribute('href')).toBe(
      '/espaces',
    );
  });

  it('renvoie un visiteur sans session vers la connexion, et le DIT', async () => {
    getSession.mockReturnValue(Promise.resolve(null));
    await renderNotFound();

    const link = screen.getByRole('link', { name: 'Aller à la connexion' });
    expect(link.getAttribute('href')).toBe('/connexion');
  });

  it('porte l’ancre du lien d’évitement et un vrai titre de niveau 1', async () => {
    getSession.mockReturnValue(Promise.resolve({ id: 'u1', role: 'ADMIN' }));
    await renderNotFound();

    expect(screen.getByRole('heading', { level: 1, name: 'Page introuvable' })).toBeTruthy();
    expect(screen.getByRole('main').getAttribute('id')).toBe('contenu-principal');
  });
});
