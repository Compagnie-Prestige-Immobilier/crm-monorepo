'use client';

import { useCallback, useEffect, useState } from 'react';

import { liveInterval, liveLabel, type LiveState } from '@/lib/live';

/**
 * Visibilité de l'onglet.
 *
 * Le sondage s'arrête quand la page passe en arrière-plan. Sans cela, un panel
 * laissé ouvert la nuit émettrait des milliers de requêtes pour un écran que
 * personne ne regarde, et entamerait le quota de l'API au petit matin, à
 * l'heure exacte où les téléconseillers se connectent.
 */
function useDocumentHidden(): boolean {
  const [hidden, setHidden] = useState(
    () => typeof document !== 'undefined' && document.visibilityState === 'hidden',
  );

  useEffect(() => {
    const sync = (): void => {
      setHidden(document.visibilityState === 'hidden');
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => {
      document.removeEventListener('visibilitychange', sync);
    };
  }, []);

  return hidden;
}

export interface Live {
  /**
   * À passer tel quel à `refetchInterval`.
   *
   * Une FONCTION et non un nombre : l'état d'échec appartient à la requête, et
   * une valeur calculée avant l'appel de `useQuery` ne pourrait pas le lire.
   * TanStack évalue cette fonction à chaque planification, ce qui fait aussi
   * que la mise en pause prend effet sans attendre le cycle en cours.
   */
  readonly refetchInterval: (query: { state: { status: string } }) => number | false;
  /** État courant, pour l'indicateur. `failing` vient de l'appelant. */
  readonly stateOf: (failing: boolean) => LiveState;
  readonly labelOf: (failing: boolean) => string;
  readonly paused: boolean;
  readonly togglePause: () => void;
}

/**
 * Pilotage du rafraîchissement continu.
 *
 * La pause manuelle existe pour une raison précise : un écran qui se réordonne
 * pendant qu'on lit une ligne est inutilisable. Elle est offerte, jamais
 * imposée.
 */
export function useLive(): Live {
  const hidden = useDocumentHidden();
  const [paused, setPaused] = useState(false);

  const stateOf = useCallback(
    (failing: boolean): LiveState => ({ hidden, failing, paused }),
    [hidden, paused],
  );

  const refetchInterval = useCallback(
    (query: { state: { status: string } }): number | false =>
      liveInterval(stateOf(query.state.status === 'error')),
    [stateOf],
  );

  const togglePause = useCallback(() => {
    setPaused((current) => !current);
  }, []);

  return {
    refetchInterval,
    stateOf,
    labelOf: (failing: boolean) => liveLabel(stateOf(failing)),
    paused,
    togglePause,
  };
}
