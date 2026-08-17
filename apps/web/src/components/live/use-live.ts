'use client';

import { useCallback, useEffect, useState } from 'react';

import { liveInterval, liveLabel, type LiveState } from '@/lib/live';

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
  readonly refetchInterval: (query: { state: { status: string } }) => number | false;
  readonly stateOf: (failing: boolean) => LiveState;
  readonly labelOf: (failing: boolean) => string;
  readonly paused: boolean;
  readonly togglePause: () => void;
}

export function useLive(options?: { intervalMs?: number }): Live {
  const intervalMs = options?.intervalMs;
  const hidden = useDocumentHidden();
  const [paused, setPaused] = useState(false);

  const stateOf = useCallback(
    (failing: boolean): LiveState => ({ hidden, failing, paused }),
    [hidden, paused],
  );

  const refetchInterval = useCallback(
    (query: { state: { status: string } }): number | false =>
      liveInterval(stateOf(query.state.status === 'error'), intervalMs),
    [stateOf, intervalMs],
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
