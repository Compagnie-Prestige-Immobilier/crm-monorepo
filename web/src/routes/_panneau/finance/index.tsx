import { createFileRoute } from '@tanstack/react-router';

import { BankDashboardSkeleton, BankDashboardView } from '@/components/bank/bank-dashboard-view';
import { BankFiltersBarSkeleton } from '@/components/bank/bank-filters-bar';
import { guardRoles } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/finance/')({
  beforeLoad: guardRoles(['ADMIN', 'BANQUE_FINANCE', 'SUPERVISEUR', 'DIRECTION']),
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

function BanqueDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <BankDashboardView />
    </div>
  );
}
