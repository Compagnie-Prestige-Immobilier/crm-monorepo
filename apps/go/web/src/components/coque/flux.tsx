import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { liveLabel } from '@/lib/live';
import {
  LIVE_STREAM_PATH,
  LIVE_TOPIC_KEYS,
  setLiveStreamConnected,
  useLiveStreamConnected,
} from '@/lib/live-stream';
import { cn } from '@/lib/utils';

const BATTEMENT_MS = 60_000;

/**
 * Une seule connexion SSE par onglet. Chaque événement nommé invalide ses
 * requêtes ; `EventSource` rouvre seul après une coupure. Le battement de
 * présence suit le même cycle de vie, et se tait quand l'onglet passe au fond.
 */
export function Flux(): null {
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

  useEffect(() => {
    const battre = (): void => {
      if (document.visibilityState !== 'visible') return;
      void fetch('/api/v1/presence/beat', { method: 'POST', credentials: 'same-origin' }).catch(
        () => undefined,
      );
    };
    battre();
    const timer = setInterval(battre, BATTEMENT_MS);
    document.addEventListener('visibilitychange', battre);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', battre);
    };
  }, []);

  return null;
}

export function IndicateurDirect({ className }: { className?: string | undefined }) {
  const connecte = useLiveStreamConnected();
  const label = liveLabel({ hidden: false, paused: false, failing: !connecte });

  return (
    <span
      role="status"
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-[0.75rem]',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'size-2 rounded-full transition-colors duration-(--dur-1) ease-(--ease-out-cpi)',
          connecte ? 'bg-success' : 'bg-destructive',
        )}
      />
      <span className={connecte ? 'text-success' : 'text-muted-foreground'}>{label}</span>
    </span>
  );
}
