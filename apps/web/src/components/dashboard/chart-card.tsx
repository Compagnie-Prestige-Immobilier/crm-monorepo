import { useRef, type ReactNode } from 'react';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { InfoPopover } from '@/components/stats/stat-info';
import { cn } from '@/lib/utils';
import { useCanvasPresentation } from '@/lib/use-canvas-presentation';

const HAUTEURS = { compacte: 'min-h-20', normale: 'h-64', haute: 'h-80' } as const;

export function ChartCard({
  title,
  description,
  children,
  className,
  hauteur = 'normale',
  actions,
  info,
}: {
  title: string;
  description?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
  /**
   * Une carte pleine largeur mérite plus de hauteur qu'une demi-carte ; une
   * tuile sans canvas n'a pas besoin de la zone réservée à Chart.js.
   */
  hauteur?: 'compacte' | 'normale' | 'haute';
  actions?: ReactNode | undefined;
  info?: string | undefined;
}) {
  const chartRegion = useRef<HTMLDivElement>(null);

  useCanvasPresentation(chartRegion);

  return (
    <Card className={cn('animate-rise', className)}>
      <CardHeader className={actions === undefined ? undefined : 'flex-row items-start gap-3'}>
        <div className="min-w-0 flex-1">
          <CardTitle className="flex items-center gap-1.5">
            {title}
            {info === undefined ? null : <InfoPopover label={title} description={info} />}
          </CardTitle>
          {description !== undefined ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {actions}
      </CardHeader>
      {/* Hauteur fixe : Chart.js mesure son conteneur, et un parent
          auto-dimensionné produit une boucle de redimensionnement. */}
      <div
        ref={chartRegion}
        className={cn('px-5 pb-1', HAUTEURS[hauteur])}
        role="group"
        aria-label={`${title} graphique`}
      >
        {children}
      </div>
    </Card>
  );
}
