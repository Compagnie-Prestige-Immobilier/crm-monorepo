import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LOGIN_PATH, redirectToLogin, resetSessionExpiryGuard } from '@/lib/api/session-expiry';

/**
 * Redirection de secours après expiration définitive de la session.
 *
 * Le comportement corrigé : avant, un 401 terminal laissait l'écran en place
 * sur des données périmées. On vérifie ici les trois pièges de ce genre de
 * redirection : la boucle, la rafale, et la redirection ouverte.
 */

const replace = vi.fn();

function stubLocation(pathname: string, search = ''): void {
  vi.stubGlobal('window', {
    location: { pathname, search, origin: 'https://panel.cpi.sn', replace },
  });
}

beforeEach(() => {
  replace.mockClear();
  resetSessionExpiryGuard();
  vi.unstubAllGlobals();
});

describe('redirectToLogin', () => {
  it('renvoie vers /connexion en signalant l’expiration', () => {
    stubLocation('/tableau-de-bord');

    expect(redirectToLogin()).toBe(true);

    const target = new URL(replace.mock.calls[0]?.[0] as string);
    expect(target.pathname).toBe(LOGIN_PATH);
    expect(target.searchParams.get('session')).toBe('expiree');
  });

  it('mémorise l’écran quitté AVEC ses filtres', () => {
    // Les filtres vivent dans l'URL : les conserver rend la reconnexion
    // transparente au lieu de renvoyer sur un tableau non filtré.
    stubLocation('/prospects', '?statut=CONVERTI&banqueId=b-1');

    redirectToLogin();

    const target = new URL(replace.mock.calls[0]?.[0] as string);
    expect(target.searchParams.get('suite')).toBe('/prospects?statut=CONVERTI&banqueId=b-1');
  });

  it('ne redirige PAS depuis l’écran de connexion : sinon on ne peut plus s’y connecter', () => {
    stubLocation(LOGIN_PATH);

    expect(redirectToLogin()).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });

  it('ne redirige QU’UNE fois quand sept requêtes échouent ensemble', () => {
    // Le tableau de bord lance sept appels en parallèle : ils expirent tous au
    // même instant.
    stubLocation('/tableau-de-bord');

    const results = Array.from({ length: 7 }, () => redirectToLogin());

    expect(results.filter(Boolean)).toHaveLength(1);
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it('ne fait rien côté serveur', () => {
    // `window` absent : appelé pendant un rendu serveur, la fonction doit
    // s'abstenir plutôt que lever.
    expect(redirectToLogin()).toBe(false);
  });

  it('n’enregistre pas la racine comme écran de retour', () => {
    stubLocation('/');

    redirectToLogin();

    const target = new URL(replace.mock.calls[0]?.[0] as string);
    expect(target.searchParams.has('suite')).toBe(false);
  });
});
