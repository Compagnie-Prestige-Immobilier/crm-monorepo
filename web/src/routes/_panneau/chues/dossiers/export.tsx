import { createFileRoute } from '@tanstack/react-router';

import { BankCasesSkeleton } from '@/components/bank/bank-cases-view';
import { BankExportView } from '@/components/bank/bank-export-view';
import { BankFiltersBarSkeleton } from '@/components/bank/bank-filters-bar';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/chues/dossiers/export')({
  beforeLoad: guardRoles(['ADMIN', 'BANQUE_FINANCE']),
  component: ExportDossiersPage,
  pendingComponent: Loading,
});

function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-4 w-96" />
        <Skeleton className="h-11 w-56" />
      </div>
      <BankFiltersBarSkeleton />
      <BankCasesSkeleton />
    </div>
  );
}

/** La page `(panel)/chues/dossiers/export` de la v1. */
function ExportDossiersPage() {
  return <BankExportView projet="CHUES" />;
}
