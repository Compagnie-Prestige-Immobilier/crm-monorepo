import { createFileRoute } from '@tanstack/react-router';

import { ChampsConversionView } from '@/components/settings/champs-conversion-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/admin/champs-conversion')({
  beforeLoad: guardRoles(['ADMIN']),
  component: ChampsConversionPage,
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

/** La page `(panel)/admin/champs-conversion` de la v1. */
function ChampsConversionPage() {
  return <ChampsConversionView />;
}
