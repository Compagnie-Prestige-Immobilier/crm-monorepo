import { createFileRoute } from '@tanstack/react-router';

import { BankCaseForm } from '@/components/bank/bank-case-form';
import { GrandPublicTableSkeleton } from '@/components/grand-public/prospects-view';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/grand-public/dossiers/nouveau')({
  beforeLoad: guardRoles(['ADMIN', 'BANQUE_FINANCE']),
  component: NouveauDossierGrandPublicPage,
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

/** La page `(panel)/grand-public/dossiers/nouveau` de la v1. */
function NouveauDossierGrandPublicPage() {
  return <BankCaseForm projet="GRAND_PUBLIC" />;
}
