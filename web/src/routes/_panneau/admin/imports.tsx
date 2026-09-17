import { createFileRoute } from '@tanstack/react-router';
import { useSearchParams } from 'next/navigation';

import { ImportsView } from '@/components/imports/imports-view';
import { Skeleton } from '@/components/ui/skeleton';
import { UPLOADABLE_IMPORT_KINDS } from '@/lib/data/imports';
import { guardPermission } from '@/lib/guard';
import { readEnum } from '@/lib/search-params';

export const Route = createFileRoute('/_panneau/admin/imports')({
  beforeLoad: guardPermission('imports.administrer'),
  component: ImportsPage,
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

/** La page `(panel)/admin/imports` de la v1. */
function ImportsPage() {
  const kind = readEnum(useSearchParams(), 'kind', UPLOADABLE_IMPORT_KINDS);

  return <ImportsView initialKind={kind ?? 'PROSPECTS'} />;
}
