import { flushSync } from 'react-dom';

/** Anime le passage d'une disposition à l'autre quand le navigateur sait le faire, sinon applique tel quel. */
export function avecTransition(miseAJour: () => void): void {
  if (typeof document === 'undefined' || typeof document.startViewTransition !== 'function') {
    miseAJour();
    return;
  }
  document.startViewTransition(() => {
    flushSync(miseAJour);
  });
}
