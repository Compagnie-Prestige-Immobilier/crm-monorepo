'use client';

import { ChevronRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { AnimatedNumber } from '@/components/live/animated-number';
import { Badge } from '@/components/ui/badge';
import type { PerformanceScore } from '@/lib/data/admin';
import { formatDecimal, formatRate } from '@/lib/format';

const SCORE_REASONS: Record<NonNullable<PerformanceScore['reason']>, string> = {
  journee_non_commencee: 'Journée pas commencée',
  presence_non_mesuree: 'Présence non mesurée',
  aucun_appel: 'Aucun appel',
};

const SECTION_TITLE =
  'mb-1 text-[0.75rem] font-[600] uppercase tracking-wide text-muted-foreground';

function scoreVariant(value: number): 'success' | 'warning' | 'destructive' {
  if (value >= 75) return 'success';
  if (value >= 50) return 'warning';
  return 'destructive';
}

export function ScoreBadge({ score }: { score: PerformanceScore }) {
  if (score.value === null) {
    return (
      <Badge variant="outline">
        {score.reason === null ? 'Sans objet' : SCORE_REASONS[score.reason]}
      </Badge>
    );
  }

  return (
    <Badge variant={scoreVariant(score.value)} className="tabular-nums">
      <AnimatedNumber value={Math.round(score.value)} />
    </Badge>
  );
}

/** Une note absente n'est pas une note basse : -1 la range derrière le zéro. */
export function byScoreDesc<T extends { score: PerformanceScore }>(rows: readonly T[]): T[] {
  return [...rows].sort((a, b) => (b.score.value ?? -1) - (a.score.value ?? -1));
}

export function callsPerActiveHour(calls: number, activeSecondsInShifts: number): string {
  if (activeSecondsInShifts === 0) return 'Sans objet';
  return formatDecimal(calls / (activeSecondsInShifts / 3600));
}

export function ScoreToggle({
  open,
  onToggle,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="flex w-full items-center gap-2 rounded-md text-left outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <ChevronRightIcon
        className={`size-4 shrink-0 text-muted-foreground transition-transform duration-(--dur-2) ease-(--ease-out-cpi) ${open ? 'rotate-90' : ''}`}
        aria-hidden="true"
      />
      <span>{children}</span>
    </button>
  );
}

export function ScoreFacts({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className={SECTION_TITLE}>{title}</h3>
      <dl className="flex flex-col gap-1">{children}</dl>
    </section>
  );
}

export function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">
        {value}
        {note === undefined ? null : (
          <span className="ml-2 text-[0.75rem] text-muted-foreground">{note}</span>
        )}
      </dd>
    </div>
  );
}

export function ScoreParts({ parts }: { parts: PerformanceScore['parts'] }) {
  if (parts.length === 0) return null;
  return (
    <ScoreFacts title="Détail de la note">
      {parts.map((part) => (
        <Fact
          key={part.key}
          label={part.label}
          value={formatRate(Math.round(part.ratio * 100))}
          note={`poids ${formatRate(Math.round(part.weight * 100))}`}
        />
      ))}
    </ScoreFacts>
  );
}
