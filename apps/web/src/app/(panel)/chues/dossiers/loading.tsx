import { BankCasesSkeleton } from '@/components/bank/bank-cases-view';
import { BankFiltersBarSkeleton } from '@/components/bank/bank-filters-bar';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
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
