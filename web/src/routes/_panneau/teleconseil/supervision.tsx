import { createFileRoute } from '@tanstack/react-router';
import { Suspense } from 'react';

import { SupervisionTabs } from '@/components/supervision/supervision-tabs';
import { ProjetBadge } from '@/components/prospects/projet-badge';
import { SupervisionSkeleton } from '@/components/supervision/supervision-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/teleconseil/supervision')({
  beforeLoad: guardRoles(['ADMIN', 'SUPERVISEUR', 'DIRECTION']),
  component: TeleconseilSupervisionPage,
  pendingComponent: Loading,
});

function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement de l’écran">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-11 w-44" />
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  );
}

/** La page `/teleconseil/supervision` unifiée. */
function TeleconseilSupervisionPage() {
  return (
    <Suspense fallback={<SupervisionSkeleton />}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
          Supervision :
          <ProjetBadge projet="CHUES" />
          <ProjetBadge projet="GRAND_PUBLIC" />
        </div>
        <SupervisionTabs projet={null} />
      </div>
    </Suspense>
  );
}
