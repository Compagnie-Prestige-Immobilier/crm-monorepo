'use client';

import { useSyncExternalStore } from 'react';

const REQUETE = '(prefers-reduced-motion: reduce)';

function abonner(prevenir: () => void): () => void {
  const query = window.matchMedia(REQUETE);
  query.addEventListener('change', prevenir);
  return () => {
    query.removeEventListener('change', prevenir);
  };
}

export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(abonner, () => window.matchMedia(REQUETE).matches);
}
