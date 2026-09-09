import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { varianteCouleur } from '@/components/banque/flux';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { EtapeBanque } from '@/lib/data/bank-cases';
import { cn } from '@/lib/utils';

export function EtapeBadge({
  etape,
  className,
}: {
  etape: EtapeBanque;
  className?: string | undefined;
}) {
  return (
    <Badge variant={varianteCouleur(etape.color)} className={cn('max-w-full', className)}>
      <span className="truncate">{etape.label}</span>
      {etape.isActive ? null : <span className="shrink-0 opacity-80"> (désactivée)</span>}
    </Badge>
  );
}

export function EtatVide({
  icone: Icone,
  titre,
  description,
  action,
}: {
  icone: LucideIcon;
  titre: string;
  description: string;
  action?: ReactNode | undefined;
}) {
  return (
    <Card className="animate-rise items-center gap-3 border-dashed px-6 py-16 text-center">
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary"
      >
        <Icone className="size-6" />
      </span>
      <h2 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">{titre}</h2>
      <p className="max-w-md text-[0.9375rem] text-muted-foreground">{description}</p>
      {action}
    </Card>
  );
}

export function SqueletteCartes({ lignes = 6 }: { lignes?: number | undefined }) {
  return (
    <div className="flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: lignes }, (_, index) => index).map((index) => (
        <Card key={index}>
          <CardContent className="flex flex-col gap-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-3 w-72" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ChampObligatoire() {
  return (
    <span className="text-destructive" aria-label="obligatoire">
      *
    </span>
  );
}
