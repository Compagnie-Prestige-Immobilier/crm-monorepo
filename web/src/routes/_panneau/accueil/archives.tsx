import { createFileRoute } from '@tanstack/react-router';

import { ArchivesView } from '@/components/accueil/archives-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardPermission } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/accueil/archives')({
  beforeLoad: guardPermission('visites.voir_archivees'),
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
