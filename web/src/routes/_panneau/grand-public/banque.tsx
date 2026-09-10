import { createFileRoute } from '@tanstack/react-router';

import { BankDashboardView } from '@/components/bank/bank-dashboard-view';
import { GrandPublicTableSkeleton } from '@/components/grand-public/prospects-view';
import { OngletsPilotage } from '@/components/pilotage/onglets';
import { Skeleton } from '@/components/ui/skeleton';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/grand-public/banque')({
  beforeLoad: guardRoles(['ADMIN', 'BANQUE_FINANCE']),
  component: BanqueGrandPublicPage,
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

/** La page `(panel)/grand-public/banque` de la v1. */
function BanqueGrandPublicPage() {
  const { user } = Route.useRouteContext();

  if (user.role !== 'ADMIN') return <BankDashboardView projet="GRAND_PUBLIC" />;

  return (
    <div className="flex flex-col gap-6">
      <OngletsPilotage coque="grand-public" role={user.role} />
      <BankDashboardView projet="GRAND_PUBLIC" />
    </div>
  );
}
