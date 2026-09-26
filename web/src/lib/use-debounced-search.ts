'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { SEARCH_DEBOUNCE_MS } from '@/lib/use-debounced-value';

/**
 * Champ de recherche temporisé, aligné sur une valeur publiée ailleurs (l'URL).
 *
 * Seule une FRAPPE programme une publication. Une valeur qui change de
 * l'extérieur — « Tout effacer », un retour arrière — annule le report en
 * cours : sinon celui-ci republiait l'ancienne recherche par-dessus la remise
 * à zéro, puis la re-vidait 350 ms plus tard.
 */
export function useDebouncedSearch(
  value: string,
  commit: (next: string) => void,
  delayMs: number = SEARCH_DEBOUNCE_MS,
): { draft: string; setDraft: (next: string) => void; reset: (next: string) => void } {
  const [draft, setDraft] = useState(value);
  const [amont, setAmont] = useState(value);
  if (amont !== value) {
    setAmont(value);
    setDraft(value);
  }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitRef = useRef(commit);

  useEffect(() => {
    commitRef.current = commit;
  }, [commit]);

  const cancel = useCallback(() => {
    if (timer.current === null) return;
    clearTimeout(timer.current);
    timer.current = null;
  }, []);

  useEffect(() => {
    cancel();
  }, [cancel, value]);

  useEffect(() => cancel, [cancel]);

  const type = useCallback(
    (next: string) => {
      setDraft(next);
      cancel();
      timer.current = setTimeout(() => {
        timer.current = null;
        commitRef.current(next);
      }, delayMs);
    },
    [cancel, delayMs],
  );

  /**
   * Repose le champ SANS rien publier. Nécessaire quand la valeur publiée ne
   * change pas : rouvrir la fusion sur une autre fiche remet `search` à la
   * chaîne vide qu'il portait déjà, et le report en cours partait quand même.
   */
  const reset = useCallback(
    (next: string) => {
      cancel();
      setDraft(next);
    },
    [cancel],
  );

  return { draft, setDraft: type, reset };
}
