'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { LiveIndicator } from '@/components/live/live-indicator';
import { useLive } from '@/components/live/use-live';
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
import { shouldShowError, shouldShowSkeleton } from '@/lib/live';
import { queryKeys } from '@/lib/query-keys';

/**
 * Tableau de bord des prospects, rafraîchi en continu.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Trois règles gouvernent le rafraîchissement, et elles ne sont pas
 * cosmétiques : sans elles, un écran « temps réel » devient illisible.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. `keepPreviousData` : les chiffres RESTENT à l'écran pendant le cycle
 *    suivant. Sans cela, le tableau de bord repasserait par son squelette
 *    toutes les dix secondes — l'écran clignoterait en permanence.
 * 2. Les valeurs GLISSENT (voir `AnimatedNumber`), elles ne sautent pas. Un
 *    nombre qui change d'un coup se lit comme un scintillement ; un nombre qui
 *    monte se lit comme une hausse.
 * 3. Un cycle en échec n'efface RIEN. L'indicateur passe à « Interrompu », le
 *    rythme ralentit, et les derniers chiffres connus restent affichés — mieux
 *    vaut une donnée datée et signalée qu'un écran vide.
 *
 * `prefers-reduced-motion` coupe l'interpolation des compteurs comme celle des
 * graphiques : la durée tombe à zéro, la logique ne change pas (§7).
 */
export function DashboardView() {
  const { filters } = useProspectFilters();
  const live = useLive();

  const { data, isPending, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: queryKeys.dashboard(filters),
    // Les statistiques prennent EXACTEMENT le filtre du tableau : les chiffres
    // affichés ici décrivent la même population que la liste des prospects.
    queryFn: () => fetchDashboardStats(filters),
    refetchInterval: live.refetchInterval,
    placeholderData: keepPreviousData,
  });

  const hasData = data !== undefined;

  return (
    <div className="flex flex-col gap-6">
      <FiltersBar />

      <div className="flex flex-wrap items-center justify-end gap-3">
        <LiveIndicator
          state={live.stateOf(isError)}
          label={live.labelOf(isError)}
          updatedAt={hasData ? dataUpdatedAt : null}
          onTogglePause={live.togglePause}
        />
      </div>

      {shouldShowError({ isError, hasData }) ? (
        <QueryErrorState
          error={error}
          onRetry={() => {
            void refetch();
          }}
          fallback="Les statistiques n’ont pas pu être calculées. Réessayez."
        />
      ) : shouldShowSkeleton({ isPending, hasData }) || data === undefined ? (
        <DashboardChartsSkeleton />
      ) : (
        <>
          <KpiCards kpis={data.kpis} />

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartCard
              title="Prospects dans le temps"
              description="Cumul sur la période filtrée"
              className="xl:col-span-2"
            >
              <ProspectsTrendChart points={data.prospectsOverTime} />
            </ChartCard>

            <ChartCard title="Téléconseillers" description="Prospects apportés">
              <RankBarChart items={data.topCommerciaux} label="Prospects" />
            </ChartCard>

            <ChartCard title="Représentants" description="Prospects rattachés">
              <RankBarChart items={data.topRepresentants} label="Prospects" />
            </ChartCard>

            <ChartCard title="Par département" description="Répartition géographique">
              <CategoryBarChart items={data.parDepartement} label="Prospects" />
            </ChartCard>

            <ChartCard title="Par banque" description="Domiciliation déclarée">
              <ShareDoughnutChart items={data.parBanque} />
            </ChartCard>

            <ChartCard
              title="Par syndicat"
              description="Appartenance déclarée"
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
