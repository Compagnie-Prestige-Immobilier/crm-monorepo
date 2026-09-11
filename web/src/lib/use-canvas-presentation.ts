import { useEffect, type RefObject } from 'react';

/** Retire le rôle image des canevas hérités afin que le SVG du diagramme porte le nom. */
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
