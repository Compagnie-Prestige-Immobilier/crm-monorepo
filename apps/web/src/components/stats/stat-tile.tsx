'use client';

import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { AnimatedNumber } from '@/components/live/animated-number';
import { StatInfo } from '@/components/stats/stat-info';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { StatKey } from '@/lib/stat-explanations';

export function StatTile({
  stat,
  label,
  value,
  hint,
  icon: Icon,
  index = 0,
  tone,
}: {
  stat: StatKey;
  label: string;
  value: number | React.ReactNode;
  hint?: React.ReactNode | undefined;
  icon: LucideIcon;
  index?: number;
  tone?: 'default' | 'success' | 'destructive' | 'warning';
}) {
  const valueColor =
    tone === 'success'
      ? 'text-success'
      : tone === 'destructive'
        ? 'text-destructive'
        : tone === 'warning'
          ? // §2.3 : `--warning` vaut #856011, la seule déclinaison or lisible
            'text-warning'
          : '';

  return (
    <Card className="animate-rise" style={{ animationDelay: `${String(index * 60)}ms` }}>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[0.75rem] font-[600] uppercase tracking-wide text-muted-foreground">
            <span className="truncate">{label}</span>
            <StatInfo stat={stat} label={label} />
          </p>

          {typeof value === 'number' ? (
            <AnimatedNumber
              value={value}
              className={`mt-1 block font-display text-[1.75rem] font-[800] leading-none tracking-[-0.02em] tabular-nums ${valueColor}`}
            />
          ) : (
            <p
              className={`mt-1 font-display text-[1.75rem] font-[800] leading-none tracking-[-0.02em] tabular-nums ${valueColor}`}
            >
              {value}
            </p>
          )}

          {hint !== undefined ? (
            <p className="mt-2 text-[0.75rem] text-muted-foreground tabular-nums">{hint}</p>
          ) : null}
        </div>
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-primary"
        >
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}

export function StatChartCard({
  stat,
  title,
  description,
  className,
  children,
}: {
  stat: StatKey;
  title: string;
  description?: string | undefined;
  className?: string | undefined;
  children: React.ReactNode;
}) {
  const chartRegion = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chartRegion.current?.querySelector('canvas')?.setAttribute('role', 'presentation');
  }, []);

  return (
    <Card className={`animate-rise ${className ?? ''}`}>
      <div className="flex flex-col gap-1 px-5 pt-5">
        <h2 className="flex items-center gap-2 font-display text-[1.0625rem] font-[700] tracking-[-0.02em]">
          {title}
          <StatInfo stat={stat} label={title} />
        </h2>
        {description !== undefined ? (
          <p className="text-[0.8125rem] text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {/* Hauteur fixe : Chart.js mesure son conteneur, et un parent
          auto-dimensionné produit une boucle de redimensionnement. */}
      <div
        ref={chartRegion}
        className="h-64 px-5 pb-1"
        role="group"
        aria-label={`${title} graphique`}
      >
        {children}
      </div>
    </Card>
  );
}

export function StatTilesSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <Card key={index}>
          <CardContent className="flex items-start justify-between gap-3">
            <div className="w-full">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-7 w-20" />
              <Skeleton className="mt-3 h-3 w-32" />
            </div>
            <Skeleton className="size-10 rounded-md" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function StatChartsSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 xl:grid-cols-2" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <Card key={index}>
          <div className="px-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-3 w-56" />
          </div>
          <div className="px-5 pb-1">
            <Skeleton className="h-56 w-full rounded-md" />
          </div>
        </Card>
      ))}
    </div>
  );
}
