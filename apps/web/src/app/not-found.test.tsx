import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Le seul bouton d'une page 404 menait à un écran réservé à l'ADMIN.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * « Retour au tableau de bord » pointait sur `/tableau-de-bord` en dur. Pour un
 * agent BANQUE_FINANCE, la seule issue d'un 404 était donc un SECOND cul-de-sac,
 * « Accès refusé », depuis lequel il fallait recommencer : deux impasses
 * enchaînées à partir d'une faute de frappe dans une URL.
 *
 * Le test vise la CIBLE du lien pour chaque rôle, parce que c'est le seul détail
 * qui distingue le correctif de la version fautive : le libellé, lui, n'a pas
 * changé.
 */

const getSession = vi.fn();

vi.mock('@/lib/session', () => ({
  getSession: () => getSession() as unknown,
}));

const NotFound = (await import('@/app/not-found')).default;

/**
 * `NotFound` est un composant serveur ASYNCHRONE : `render()` ne sait pas
 * l'attendre. On l'appelle donc comme la fonction qu'il est, et on rend l'arbre
 * qu'il renvoie. C'est exactement ce que fait Next, en amont de l'hydratation.
 */
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

  /**
   * Le lien d'évitement du layout racine pointe sur cette ancre. Sans elle,
   * l'utilisateur au clavier qui active « Aller au contenu » sur cette page ne
   * va nulle part, ce qui est le comble sur un écran dont tout l'objet est de
   * proposer une sortie.
   */
  it('porte l’ancre du lien d’évitement et un vrai titre de niveau 1', async () => {
    getSession.mockReturnValue(Promise.resolve({ id: 'u1', role: 'ADMIN' }));
    await renderNotFound();

    expect(screen.getByRole('heading', { level: 1, name: 'Page introuvable' })).toBeTruthy();
    expect(screen.getByRole('main').getAttribute('id')).toBe('contenu-principal');
  });
});
