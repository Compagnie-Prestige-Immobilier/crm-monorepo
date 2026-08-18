import { DashboardChartsSkeleton } from '@/components/dashboard/dashboard-view';
import { FiltersBarSkeleton } from '@/components/filters/filters-bar';

export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <FiltersBarSkeleton />
      <DashboardChartsSkeleton />
    </div>
  );
}
