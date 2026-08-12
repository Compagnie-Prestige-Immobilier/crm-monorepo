import { DashboardChartsSkeleton } from '@/components/dashboard/dashboard-view';
import { FiltersBarSkeleton } from '@/components/filters/filters-bar';

/**
 * Squelettes, jamais de rouet : ils réservent la place exacte des cartes et des
 * graphiques, si bien que rien ne bouge à l'arrivée des données.
 */
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <FiltersBarSkeleton />
      <DashboardChartsSkeleton />
    </div>
  );
}
