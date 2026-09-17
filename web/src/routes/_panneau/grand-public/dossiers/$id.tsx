import { createFileRoute } from '@tanstack/react-router';

import { BankCaseDetailView } from '@/components/bank/bank-case-detail-view';
import { GrandPublicTableSkeleton } from '@/components/grand-public/prospects-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardPermission } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/grand-public/dossiers/$id')({
  beforeLoad: guardPermission('banque.dossiers'),
  component: DossierGrandPublicPage,
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

/** La page `(panel)/grand-public/dossiers/[id]` de la v1. */
function DossierGrandPublicPage() {
  const { id } = Route.useParams();

  return <BankCaseDetailView caseId={id} projet="GRAND_PUBLIC" />;
}
