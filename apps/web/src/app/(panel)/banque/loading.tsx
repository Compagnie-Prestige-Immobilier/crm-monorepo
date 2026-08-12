import { BankDashboardSkeleton } from '@/components/bank/bank-dashboard-view';
import { BankFiltersBarSkeleton } from '@/components/bank/bank-filters-bar';

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <BankFiltersBarSkeleton />
      <BankDashboardSkeleton />
    </div>
  );
}
