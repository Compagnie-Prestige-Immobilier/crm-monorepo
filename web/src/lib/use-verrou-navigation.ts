'use client';

/**
 * Une navigation lancée par le code n'est vue par aucun écouteur du DOM : elle
 * demande ce garde, à appeler avant tout `router.push`.
 */
export function navigationRetenue(): boolean {
  return false;
}

/** Le même verrou, sans son message : pour l'appelant qui a le sien. */
export function ficheTenue(): boolean {
  return false;
}

/**
 * Next.js App Router n'expose aucune API de blocage. Trois prises seulement :
 * la fermeture de l'onglet, le clic sur un lien, et le retour arrière.
 */
export function useVerrouNavigation(actif: boolean, prevenir: () => void): void {
  void actif;
  void prevenir;
}
