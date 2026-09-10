import { createFileRoute } from '@tanstack/react-router';

import { BankCasesView } from '@/components/bank/bank-cases-view';
import { GrandPublicTableSkeleton } from '@/components/grand-public/prospects-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/grand-public/dossiers/')({
  beforeLoad: guardRoles(['ADMIN', 'BANQUE_FINANCE']),
  component: DossiersGrandPublicPage,
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

/** La page `(panel)/grand-public/dossiers` de la v1. */
function DossiersGrandPublicPage() {
  return <BankCasesView projet="GRAND_PUBLIC" />;
}
