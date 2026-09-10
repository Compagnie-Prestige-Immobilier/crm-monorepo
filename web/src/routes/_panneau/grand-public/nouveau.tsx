import { createFileRoute } from '@tanstack/react-router';

import { GrandPublicProspectForm } from '@/components/grand-public/prospect-form';
import { GrandPublicTableSkeleton } from '@/components/grand-public/prospects-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/grand-public/nouveau')({
  beforeLoad: guardRoles(['ADMIN', 'COMMERCIAL', 'CHARGE_CLIENTELE']),
  component: NouveauGrandPublicPage,
  pendingComponent: Loading,
});

function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between gap-3">
        <Skeleton className="h-9 w-80" />
        <Skeleton className="h-12 w-52" />
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
      <GrandPublicTableSkeleton />
    </div>
  );
}

/** La page `(panel)/grand-public/nouveau` de la v1. */
function NouveauGrandPublicPage() {
  return <GrandPublicProspectForm />;
}
