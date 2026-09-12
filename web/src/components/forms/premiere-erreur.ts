import { useEffect, useState, type RefObject } from 'react';

/** Après un envoi refusé, amène le premier champ en erreur de `racine` à l'écran et y place le focus. */
export function usePremiereErreur(racine: RefObject<HTMLElement | null>): () => void {
  const [echecs, setEchecs] = useState(0);

  // Les erreurs passent par l'état : `aria-invalid` n'existe qu'au rendu qui suit l'échec.
  useEffect(() => {
    if (echecs === 0) return;
    const champ = racine.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    if (champ === null || champ === undefined) return;
    champ.scrollIntoView({ block: 'center' });
    champ.focus({ preventScroll: true });
  }, [echecs, racine]);

  return () => {
    setEchecs((nombre) => nombre + 1);
  };
}
