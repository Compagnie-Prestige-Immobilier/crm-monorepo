'use client';

import { useEffect, useRef } from 'react';

let retenue: (() => void) | null = null;

/**
 * Une navigation lancée par le code n'est vue par aucun écouteur du DOM : elle
 * demande ce garde, à appeler avant tout `router.push`.
 */
export function navigationRetenue(): boolean {
  if (retenue === null) return false;
  retenue();
  return true;
}

/** Le même verrou, sans son message : pour l'appelant qui a le sien. */
export function ficheTenue(): boolean {
  return retenue !== null;
}

/**
 * Next.js App Router n'expose aucune API de blocage. Trois prises seulement :
 * la fermeture de l'onglet, le clic sur un lien, et le retour arrière.
 */
export function useVerrouNavigation(actif: boolean, prevenir: () => void): void {
  const alerte = useRef(prevenir);

  useEffect(() => {
    alerte.current = prevenir;
  }, [prevenir]);

  useEffect(() => {
    if (!actif) return;

    const avantFermeture = (event: BeforeUnloadEvent): void => {
      event.preventDefault();
      // Safari, et Chrome avant la 119, ignorent `preventDefault()` seul.
      event.returnValue = '';
    };

    const surClic = (event: MouseEvent): void => {
      if (event.defaultPrevented || event.button !== 0) return;
      // `Element` et non `HTMLElement` : une icone dans un lien est un
      // `SVGElement`, et le clic atterrit sur elle.
      const cible = event.target;
      if (!(cible instanceof Element) || cible.closest('a[href]') === null) return;
      event.preventDefault();
      event.stopPropagation();
      alerte.current();
    };

    const surRetour = (): void => {
      window.history.pushState(null, '', window.location.href);
      alerte.current();
    };

    const notre = (): void => {
      alerte.current();
    };
    retenue = notre;

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('beforeunload', avantFermeture);
    document.addEventListener('click', surClic, true);
    window.addEventListener('popstate', surRetour);

    return () => {
      if (retenue === notre) retenue = null;
      window.removeEventListener('beforeunload', avantFermeture);
      document.removeEventListener('click', surClic, true);
      window.removeEventListener('popstate', surRetour);
    };
  }, [actif]);
}
