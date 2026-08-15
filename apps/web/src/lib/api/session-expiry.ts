/**
 * Sortie de secours quand la session est définitivement morte.
 *
 * Constat fait en conditions réelles : avec un refresh token révoqué, le relais
 * `/api/v1/*` efface bien les deux cookies et répond
 * `401 {"code":"SESSION_EXPIRED"}` : mais le navigateur, lui, ne faisait RIEN.
 * L'écran restait affiché, chaque requête échouait, et un toast conseillait de
 * « recharger la page ». L'administrateur se retrouvait devant un panel mort
 * dont les données à l'écran étaient périmées, sans comprendre pourquoi.
 *
 * Un 401 qui atteint le navigateur est forcément TERMINAL : le relais a déjà
 * tenté la rotation côté serveur. Il n'y a donc rien à réessayer, seulement à
 * renvoyer vers `/connexion`.
 *
 * La redirection est une navigation complète (`location.replace`) et non un
 * `router.push` : les cookies viennent d'être effacés, et seul un aller-retour
 * serveur reconstruit le layout avec la session absente. `replace` évite en
 * outre de laisser l'écran mort dans l'historique du bouton « précédent ».
 */

export const LOGIN_PATH = '/connexion';

/** Marqueur lu par la page de connexion pour expliquer la déconnexion. */
export const SESSION_EXPIRED_PARAM = 'session';
export const SESSION_EXPIRED_VALUE = 'expiree';

/**
 * Verrou de processus : une page de tableau de bord lance sept requêtes en
 * parallèle, qui échouent toutes ensemble. Sans ce garde-fou, sept
 * redirections concurrentes partiraient : et sur certains navigateurs, la
 * dernière écrase l'URL de retour de la première.
 */
let redirecting = false;

/** Remise à zéro pour les tests ; sans effet en production. */
export function resetSessionExpiryGuard(): void {
  redirecting = false;
}

/**
 * `true` si la redirection a été déclenchée par CET appel.
 *
 * Ne fait rien côté serveur (aucun `window`), ni si l'on est déjà sur l'écran
 * de connexion : s'y rediriger en boucle empêcherait de se reconnecter.
 */
export function redirectToLogin(): boolean {
  if (typeof window === 'undefined') return false;
  if (redirecting) return false;
  if (window.location.pathname === LOGIN_PATH) return false;

  redirecting = true;

  const target = new URL(LOGIN_PATH, window.location.origin);
  target.searchParams.set(SESSION_EXPIRED_PARAM, SESSION_EXPIRED_VALUE);

  // On mémorise l'écran quitté pour y revenir après reconnexion : filtres
  // compris, puisqu'ils vivent dans l'URL. Un administrateur qui expire au
  // milieu d'un tri filtré le retrouve intact.
  const from = `${window.location.pathname}${window.location.search}`;
  if (from !== '/' && from !== LOGIN_PATH) target.searchParams.set('suite', from);

  window.location.replace(target.toString());
  return true;
}
