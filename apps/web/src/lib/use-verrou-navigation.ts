'use client';

import { useEffect, useRef } from 'react';

/**
 * Next.js App Router n'expose aucune API de blocage. Trois prises seulement :
 * la fermeture de l'onglet, le clic sur un lien, et le retour arrière. Une
 * navigation lancée par le code, elle, passe outre.
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
    };

    const surClic = (event: MouseEvent): void => {
      if (event.defaultPrevented || event.button !== 0) return;
      const cible = event.target;
      if (!(cible instanceof HTMLElement) || cible.closest('a[href]') === null) return;
      event.preventDefault();
      event.stopPropagation();
      alerte.current();
    };

    const surRetour = (): void => {
      window.history.pushState(null, '', window.location.href);
      alerte.current();
    };

    window.history.pushState(null, '', window.location.href);
    window.addEventListener('beforeunload', avantFermeture);
    document.addEventListener('click', surClic, true);
    window.addEventListener('popstate', surRetour);

    return () => {
      window.removeEventListener('beforeunload', avantFermeture);
      document.removeEventListener('click', surClic, true);
      window.removeEventListener('popstate', surRetour);
    };
  }, [actif]);
}
