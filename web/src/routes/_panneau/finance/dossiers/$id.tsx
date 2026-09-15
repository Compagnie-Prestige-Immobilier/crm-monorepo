import { createFileRoute } from '@tanstack/react-router';

import { BankCaseDetailView } from '@/components/bank/bank-case-detail-view';
import { BankCasesSkeleton } from '@/components/bank/bank-cases-view';
import { BankFiltersBarSkeleton } from '@/components/bank/bank-filters-bar';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/finance/dossiers/$id')({
  beforeLoad: guardRoles(['ADMIN', 'BANQUE_FINANCE']),
  component: DossierPage,
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

function DossierPage() {
  const { user } = Route.useRouteContext();
  const { id } = Route.useParams();

  return <BankCaseDetailView caseId={id} role={user.role} />;
}
