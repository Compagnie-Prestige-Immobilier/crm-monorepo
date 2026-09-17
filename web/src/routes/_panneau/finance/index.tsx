import { createFileRoute } from '@tanstack/react-router';

import { BankDashboardSkeleton, BankDashboardView } from '@/components/bank/bank-dashboard-view';
import { BankFiltersBarSkeleton } from '@/components/bank/bank-filters-bar';
import { guardPermission } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/finance/')({
  beforeLoad: guardPermission('banque.lire'),
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
