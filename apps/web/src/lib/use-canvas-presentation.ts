import { useEffect, type RefObject } from 'react';

/**
 * Retire le rôle `img` du canevas de Chart.js, qui n'a pas de nom accessible.
 *
 * Un effet à passe unique ne suffit pas : le canevas n'apparaît qu'une fois les
 * données arrivées, donc après le montage. L'observateur couvre les deux ordres.
 */
export function useCanvasPresentation(region: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const host = region.current;
    if (host === null) return;

    const neutralize = (): void => {
      for (const canvas of host.querySelectorAll('canvas')) {
        canvas.setAttribute('role', 'presentation');
      }
    };

    neutralize();
    const observer = new MutationObserver(neutralize);
    observer.observe(host, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
    };
  }, [region]);
}
