import { useState } from 'react';

/**
 * `useEffect(recaler, cles)` rejoué pendant le rendu : l'état se recale sur sa source
 * sans rendu intermédiaire. `recaler` ne doit faire que des `setState` du composant.
 */
export function useRecalage(cles: readonly unknown[], recaler: () => void): void {
  const [vues, setVues] = useState<readonly unknown[] | null>(null);
  if (vues?.length === cles.length && vues.every((vue, i) => Object.is(vue, cles[i]))) return;
  setVues(cles);
  recaler();
}
