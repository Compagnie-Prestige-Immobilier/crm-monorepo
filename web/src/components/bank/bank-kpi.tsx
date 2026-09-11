import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Card, CardContent } from '@/components/ui/card';

export function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  index,
}: {
  label: string;
  value: string;
  hint: ReactNode;
  icon: LucideIcon;
  index: number;
}) {
  return (
    <Card className="animate-rise" style={{ animationDelay: `${String(index * 60)}ms` }}>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[0.75rem] font-[600] uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 font-display text-[1.75rem] font-[800] leading-none tracking-[-0.02em] tabular-nums">
            {value}
          </p>
          <p className="mt-2 text-[0.75rem] text-muted-foreground tabular-nums">{hint}</p>
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
