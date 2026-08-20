import { useRef, type ReactNode } from 'react';

import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useCanvasPresentation } from '@/lib/use-canvas-presentation';

export function ChartCard({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string | undefined;
  children: ReactNode;
  className?: string | undefined;
}) {
  const chartRegion = useRef<HTMLDivElement>(null);

  useCanvasPresentation(chartRegion);

  return (
    <Card className={cn('animate-rise', className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description !== undefined ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
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
