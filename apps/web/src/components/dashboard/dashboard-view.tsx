'use client';

import { useQuery } from '@tanstack/react-query';

import { ChartCard } from '@/components/dashboard/chart-card';
import {
  CategoryBarChart,
  ProspectsTrendChart,
  RankBarChart,
  ShareDoughnutChart,
} from '@/components/dashboard/charts';
import { KpiCards, KpiCardsSkeleton } from '@/components/dashboard/kpi-cards';
import { FiltersBar } from '@/components/filters/filters-bar';
import { useProspectFilters } from '@/components/filters/use-prospect-filters';
import { QueryErrorState } from '@/components/query-error-state';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchDashboardStats } from '@/lib/data/stats';
import { queryKeys } from '@/lib/query-keys';

export function DashboardView() {
  const { filters } = useProspectFilters();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.dashboard(filters),
    // Les statistiques prennent EXACTEMENT le filtre du tableau : les chiffres
    // affichés ici décrivent la même population que la liste des prospects.
    queryFn: () => fetchDashboardStats(filters),
  });

  return (
    <div className="flex flex-col gap-6">
      <FiltersBar />

      {/* Sans cette branche, un échec laissait `data` à `undefined` et le
          tableau de bord affichait son squelette INDÉFINIMENT : l'écran
          paraissait charger sans fin, sans jamais dire que les sept requêtes
          d'analytique avaient échoué. */}
      {isError ? (
        <QueryErrorState
          error={error}
          onRetry={() => {
            void refetch();
          }}
          fallback="Les statistiques n’ont pas pu être calculées."
        />
      ) : isPending ? (
        <DashboardChartsSkeleton />
      ) : (
        <>
          <KpiCards kpis={data.kpis} />

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard
              title="Prospects dans le temps"
              description="Cumul des saisies terrain sur la période filtrée"
              className="xl:col-span-2"
            >
              <ProspectsTrendChart points={data.prospectsOverTime} />
            </ChartCard>

            <ChartCard
              title="Top commerciaux"
              description="Prospects apportés — au-delà de 5, regroupés en « Autres »"
            >
              <RankBarChart items={data.topCommerciaux} label="Prospects" />
            </ChartCard>

            <ChartCard title="Top représentants" description="Prospects rattachés">
              <RankBarChart items={data.topRepresentants} label="Prospects" />
            </ChartCard>

            <ChartCard title="Par département" description="Répartition géographique">
              <CategoryBarChart items={data.parDepartement} label="Prospects" />
            </ChartCard>

            <ChartCard title="Par banque" description="Domiciliation bancaire déclarée">
              <ShareDoughnutChart items={data.parBanque} />
            </ChartCard>

            <ChartCard
              title="Par syndicat"
              description="Appartenance syndicale déclarée"
              className="xl:col-span-2"
            >
              <ShareDoughnutChart items={data.parSyndicat} />
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}

export function DashboardChartsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <KpiCardsSkeleton />
      <div className="grid gap-4 xl:grid-cols-2">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Card key={index} className={index === 0 ? 'xl:col-span-2' : undefined}>
            <div className="px-5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="mt-2 h-3 w-56" />
            </div>
            <div className="px-5 pb-1">
              <Skeleton className="h-56 w-full rounded-md" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
