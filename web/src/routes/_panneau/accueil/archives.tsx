import { createFileRoute } from '@tanstack/react-router';

import { ArchivesView } from '@/components/accueil/archives-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/accueil/archives')({
  beforeLoad: guardRoles(['DIRECTION']),
  component: ArchivesView,
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
