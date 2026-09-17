import { createFileRoute } from '@tanstack/react-router';

import { BasesView } from '@/components/bases/bases-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardPermission } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/admin/bases')({
  beforeLoad: guardPermission('bases.administrer'),
  component: BasesView,
  pendingComponent: Loading,
});

function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement de l’écran">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </div>
  );
}
