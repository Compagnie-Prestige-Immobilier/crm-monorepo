import type * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Squelette de chargement — jamais un spinner (exigence produit).
 *
 * Un squelette conserve la géométrie de l'écran : rien ne saute quand les
 * données arrivent. Un spinner ne dit ni ce qui charge, ni quelle place cela
 * prendra, et provoque un décalage de mise en page à chaque résolution.
 *
 * `animate-pulse` est neutralisé par la règle globale `prefers-reduced-motion`
 * de globals.css ; le bloc gris reste visible, seule la pulsation disparaît.
 */
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn('animate-pulse rounded-sm bg-muted', className)}
      {...props}
    />
  );
}

export { Skeleton };
