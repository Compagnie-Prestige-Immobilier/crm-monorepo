import { createFileRoute } from '@tanstack/react-router';

import { CourrielsReglages } from '@/components/settings/courriels-reglages';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/admin/courriels')({
  beforeLoad: guardRoles(['ADMIN']),
  component: CourrielsPage,
  pendingComponent: Loading,
});

function Loading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Chargement de l’écran">
      <Skeleton className="h-24 w-full rounded-lg" />
      <Skeleton className="h-80 w-full rounded-lg" />
    </div>
  );
}

function CourrielsPage() {
  return (
    <div className="flex max-w-4xl flex-col gap-6">
      <CourrielsReglages />
    </div>
  );
}
