import { useRef, type ReactNode } from 'react';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useCanvasPresentation } from '@/lib/use-canvas-presentation';

export function ChartCard({
  title,
  description,
  children,
  className,
  hauteur = 'normale',
  actions,
}: {
  title: string;
  description?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
  /** Une carte pleine largeur mérite plus de hauteur qu'une demi-carte. */
  hauteur?: 'normale' | 'haute';
  actions?: ReactNode | undefined;
}) {
  const chartRegion = useRef<HTMLDivElement>(null);

  useCanvasPresentation(chartRegion);

  return (
    <Card className={cn('animate-rise', className)}>
      <CardHeader className={actions === undefined ? undefined : 'flex-row items-start gap-3'}>
        <div className="min-w-0 flex-1">
          <CardTitle>{title}</CardTitle>
          {description !== undefined ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {actions}
      </CardHeader>
      {/* Hauteur fixe : Chart.js mesure son conteneur, et un parent
          auto-dimensionné produit une boucle de redimensionnement. */}
      <div
        ref={chartRegion}
        className={cn('px-5 pb-1', hauteur === 'haute' ? 'h-80' : 'h-64')}
        role="group"
        aria-label={`${title} graphique`}
      >
        {children}
      </div>
    </Card>
  );
}
