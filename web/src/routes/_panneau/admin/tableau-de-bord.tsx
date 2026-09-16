import { createFileRoute } from '@tanstack/react-router';

import { AdminTableauDeBordView } from '@/components/admin/tableau-de-bord-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/admin/tableau-de-bord')({
  beforeLoad: guardRoles(['ADMIN']),
  component: AdminTableauDeBordPage,
  pendingComponent: Loading,
});

function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement du tableau de bord">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-12 w-96 rounded-lg" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  );
}

function AdminTableauDeBordPage() {
  return <AdminTableauDeBordView />;
}
