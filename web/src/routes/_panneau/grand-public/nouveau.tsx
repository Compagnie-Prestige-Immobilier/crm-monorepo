import { createFileRoute } from '@tanstack/react-router';
import { useRouter } from 'next/navigation';

import { GrandPublicTableSkeleton } from '@/components/grand-public/prospects-view';
import { NouveauProspectConsole } from '@/components/prospects/nouveau-prospect-console';
import { Skeleton } from '@/components/ui/skeleton';
import { guardPermission } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/grand-public/nouveau')({
  beforeLoad: guardPermission('fiches.tenir'),
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
  const router = useRouter();
  const retour = (): void => {
    router.push('/grand-public');
  };

  return <NouveauProspectConsole onSaved={retour} onAnnuler={retour} />;
}
