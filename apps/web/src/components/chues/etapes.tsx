'use client';

import { Skeleton } from '@/components/ui/skeleton';

export const ETAPES = [
  { n: 1, titre: 'Qualifier un représentant', href: '/chues/appels-representants' },
  { n: 2, titre: 'Ajouter un prospect', href: '/chues/prospects/nouveau' },
  { n: 3, titre: 'Convertir un prospect', href: '/chues/console' },
] as const;

export function EtapeSkeleton() {
  return (
    <div className="flex w-full flex-col gap-5">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-12 w-72" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
