import { formatNumber } from '@/lib/format';
import type { CampaignProgress } from '@/lib/types';

export function CampaignProgressBar({
  progress,
  compact = false,
}: {
  progress: CampaignProgress;
  compact?: boolean | undefined;
}) {
  const total = Math.max(1, progress.total);
  const share = (value: number): string => `${String((value / total) * 100)}%`;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div aria-hidden="true" className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
        <span className="block bg-success" style={{ width: share(progress.done) }} />
        <span className="block bg-accent" style={{ width: share(progress.open) }} />
        <span
          className="block bg-muted-foreground/40"
          style={{ width: share(progress.cancelled) }}
        />
      </div>
      <p className="text-[0.75rem] text-muted-foreground tabular-nums">
        {progress.total === 0 ? (
          'Aucune tâche'
        ) : (
          <>
            <span className="font-[600] text-foreground">{formatNumber(progress.done)}</span>{' '}
            abouties · {formatNumber(progress.open)} en attente
            {progress.cancelled > 0 ? ` · ${formatNumber(progress.cancelled)} annulées` : ''}
            {compact ? '' : ` · ${formatNumber(progress.total)} au total`}
          </>
        )}
      </p>
    </div>
  );
}
