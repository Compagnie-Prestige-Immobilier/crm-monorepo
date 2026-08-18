import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();

vi.mock('@/lib/session', () => ({
  getSession: () => getSession() as unknown,
}));

const NotFound = (await import('@/app/not-found')).default;

const renderNotFound = async (): Promise<void> => {
  render(await NotFound());
};

describe('page introuvable', () => {
  it('renvoie un ADMIN vers son tableau de bord', async () => {
    getSession.mockReturnValue(Promise.resolve({ id: 'u1', role: 'ADMIN' }));
    await renderNotFound();

    expect(screen.getByRole('link', { name: /Retour à l’accueil/ }).getAttribute('href')).toBe(
      '/tableau-de-bord',
    );
  });

  it('renvoie un agent BANQUE_FINANCE vers les dossiers, pas vers un refus de droits', async () => {
    getSession.mockReturnValue(Promise.resolve({ id: 'u2', role: 'BANQUE_FINANCE' }));
    await renderNotFound();

    expect(screen.getByRole('link', { name: /Retour à l’accueil/ }).getAttribute('href')).toBe(
      '/dossiers',
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
