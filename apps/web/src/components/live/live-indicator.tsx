'use client';

import { PauseIcon, PlayIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/format';
import type { LiveState } from '@/lib/live';

export function LiveIndicator({
  state,
  label,
  updatedAt,
  onTogglePause,
}: {
  state: LiveState;
  label: string;
  updatedAt: number | null;
  onTogglePause: () => void;
}) {
  const running = !state.paused && !state.hidden && !state.failing;
  let dotColor = 'bg-muted-foreground';
  if (state.failing) dotColor = 'bg-destructive';
  if (running) dotColor = 'bg-success';

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span
        role="status"
        className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-[0.75rem]"
      >
        <span
          aria-hidden="true"
          className={`size-2 rounded-full transition-colors duration-(--dur-1) ease-(--ease-out-cpi) ${dotColor}`}
        />
        <span className={running ? 'text-success' : 'text-muted-foreground'}>{label}</span>
      </span>

      {updatedAt !== null ? (
        <span className="text-[0.75rem] text-muted-foreground">
          Mis à jour à{' '}
          <time dateTime={new Date(updatedAt).toISOString()} className="tabular-nums">
            {formatDateTime(new Date(updatedAt).toISOString())}
          </time>
        </span>
      ) : null}

      <Button type="button" variant="ghost" size="sm" onClick={onTogglePause}>
        {state.paused ? (
          <>
            <PlayIcon aria-hidden="true" />
            Reprendre
          </>
        ) : (
          <>
            <PauseIcon aria-hidden="true" />
            Mettre en pause
          </>
        )}
      </Button>
    </div>
  );
}
