import { createFileRoute } from '@tanstack/react-router';

import { RepresentantsImportView } from '@/components/representants/representants-import-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardPermission } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/teleconseil/representants/import')({
  beforeLoad: guardPermission('imports.administrer'),
  component: TeleconseilRepresentantsImportPage,
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

/** La page `/teleconseil/representants/import` unifiée. */
function TeleconseilRepresentantsImportPage() {
  return <RepresentantsImportView />;
}
