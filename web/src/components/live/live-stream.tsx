'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { LIVE_STREAM_PATH, LIVE_TOPIC_KEYS, setLiveStreamConnected } from '@/lib/live-stream';

/**
 * Une seule connexion SSE par onglet, montée dans les coques authentifiées.
 * Chaque événement nommé invalide ses requêtes ; TanStack relit l'API.
 * `EventSource` rouvre seul après une coupure ou le renouvellement serveur.
 */
export function LiveStream(): null {
  const queryClient = useQueryClient();

  useEffect(() => {
    const source = new EventSource(LIVE_STREAM_PATH);
    source.onopen = () => {
      setLiveStreamConnected(true);
    };
    source.onerror = () => {
      setLiveStreamConnected(false);
    };
    for (const [topic, keys] of Object.entries(LIVE_TOPIC_KEYS)) {
      source.addEventListener(topic, () => {
        for (const queryKey of keys) void queryClient.invalidateQueries({ queryKey });
      });
    }
    return () => {
      source.close();
      setLiveStreamConnected(false);
    };
  }, [queryClient]);

  return null;
}
