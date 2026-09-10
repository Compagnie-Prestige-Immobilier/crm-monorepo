'use client';

import { useCallback, useEffect, useState } from 'react';

import { liveInterval, liveLabel, type LiveState } from '@/lib/live';
import { useLiveStreamConnected, type LiveTopic } from '@/lib/live-stream';

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

/** Avec `topic`, le sondage ralentit tant que le flux serveur pousse ce sujet. */
export function useLive(options?: { intervalMs?: number; topic?: LiveTopic }): Live {
  const intervalMs = options?.intervalMs;
  const hidden = useDocumentHidden();
  const streamed = useLiveStreamConnected() && options?.topic !== undefined;
  const [paused, setPaused] = useState(false);

  const stateOf = useCallback(
    (failing: boolean): LiveState => ({ hidden, failing, paused, streamed }),
    [hidden, paused, streamed],
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
