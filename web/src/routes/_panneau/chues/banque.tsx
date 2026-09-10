import { createFileRoute } from '@tanstack/react-router';

import { BankDashboardSkeleton, BankDashboardView } from '@/components/bank/bank-dashboard-view';
import { BankFiltersBarSkeleton } from '@/components/bank/bank-filters-bar';
import { OngletsPilotage } from '@/components/pilotage/onglets';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/chues/banque')({
  beforeLoad: guardRoles(['ADMIN', 'BANQUE_FINANCE']),
  component: BanqueDashboardPage,
  pendingComponent: Loading,
});

function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <BankFiltersBarSkeleton />
      <BankDashboardSkeleton />
    </div>
  );
}

/** La page `(panel)/chues/banque` de la v1. */
function BanqueDashboardPage() {
  const { user } = Route.useRouteContext();

  if (user.role !== 'ADMIN') return <BankDashboardView projet="CHUES" />;

  return (
    <div className="flex flex-col gap-6">
      <OngletsPilotage coque="chues" role={user.role} />
      <BankDashboardView projet="CHUES" />
    </div>
  );
}
