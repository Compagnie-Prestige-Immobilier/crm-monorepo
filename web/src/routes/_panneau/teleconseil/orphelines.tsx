import { createFileRoute } from '@tanstack/react-router';

import { OrphelinsView } from '@/components/orphelins/orphelins-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardPermission } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/teleconseil/orphelines')({
  beforeLoad: guardPermission('prospects.reaffecter_tout'),
  component: OrphelinsView,
  pendingComponent: Loading,
});

function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement de l’écran">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  );
}
