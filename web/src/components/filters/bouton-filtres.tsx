'use client';

import { SlidersHorizontalIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Sur téléphone, les filtres se replient derrière ce bouton pour laisser le premier chiffre à l'écran. */
export function BoutonFiltres({
  ouverts,
  actifs = 0,
  onBasculer,
  className,
}: {
  ouverts: boolean;
  actifs?: number;
  onBasculer: () => void;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn('sm:hidden', className)}
      aria-expanded={ouverts}
      onClick={onBasculer}
    >
      <SlidersHorizontalIcon aria-hidden="true" />
      Filtres
      {actifs > 0 ? <Badge variant="secondary">{actifs}</Badge> : null}
    </Button>
  );
}

export function classeRepliable(ouverts: boolean): string {
  return cn(ouverts ? 'contents' : 'hidden', 'sm:contents');
}
