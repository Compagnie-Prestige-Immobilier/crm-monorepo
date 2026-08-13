import { FiltersBarSkeleton } from '@/components/filters/filters-bar';
import { ProspectsTableSkeleton } from '@/components/prospects/prospects-table';
import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-end gap-3">
        <Skeleton className="h-11 w-44" />
      </div>
      <FiltersBarSkeleton />
      <ProspectsTableSkeleton />
    </div>
  );
}
