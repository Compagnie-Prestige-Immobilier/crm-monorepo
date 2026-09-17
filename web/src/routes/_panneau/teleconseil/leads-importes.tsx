import { createFileRoute } from '@tanstack/react-router';

import { LeadsImportesView } from '@/components/supervision/leads-importes-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardPermission } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/teleconseil/leads-importes')({
  beforeLoad: guardPermission('analytics.superviser'),
  component: LeadsImportesView,
  pendingComponent: Loading,
});

function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement de l’écran">
      <Skeleton className="h-6 w-96" />
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  );
}
