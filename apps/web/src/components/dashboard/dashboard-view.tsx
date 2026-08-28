'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { BarreEdition } from '@/components/accueil/tableau-de-bord/barre-edition';
import { LiveIndicator } from '@/components/live/live-indicator';
import { useLive } from '@/components/live/use-live';
import { ChartCard } from '@/components/dashboard/chart-card';
import {
  CategoryBarChart,
  ProspectsTrendChart,
  RankBarChart,
  ShareDoughnutChart,
} from '@/components/dashboard/charts';
import { FunnelPanel, FunnelPanelSkeleton } from '@/components/dashboard/funnel-panel';
import { KpiCards, KpiCardsSkeleton } from '@/components/dashboard/kpi-cards';
import { ExactAmountsToggle } from '@/components/money/exact-amounts';
import { FiltersBar } from '@/components/filters/filters-bar';
import { useProspectFilters } from '@/components/filters/use-prospect-filters';
import { QueryErrorInline, QueryErrorState } from '@/components/query-error-state';
import { ChartOrganizer, type ChartLayoutItem } from '@/components/stats/chart-organizer';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchFunnel } from '@/lib/data/funnel';
import { fetchStatsLayout, resetStatsLayout, saveStatsLayout } from '@/lib/data/stats-layout';
import { fetchDashboardStats } from '@/lib/data/stats';
import { shouldShowError, shouldShowSkeleton } from '@/lib/live';
import { queryKeys } from '@/lib/query-keys';

export function DashboardView() {
  const { filters } = useProspectFilters();
  const live = useLive();
  const queryClient = useQueryClient();

  const { data, isPending, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: queryKeys.dashboard(filters),
    queryFn: () => fetchDashboardStats(filters),
    refetchInterval: live.refetchInterval,
    placeholderData: keepPreviousData,
  });

  const funnelQuery = useQuery({
    queryKey: queryKeys.funnel(filters),
    queryFn: () => fetchFunnel(filters),
    refetchInterval: live.refetchInterval,
    placeholderData: keepPreviousData,
  });

  const hasData = data !== undefined;
  const funnel = funnelQuery.data;
  const layoutQuery = useQuery({
    queryKey: queryKeys.statsLayout('dashboard'),
    queryFn: () => fetchStatsLayout('dashboard'),
  });
  const [draft, setDraft] = useState<ChartLayoutItem[] | null>(null);
  const editing = draft !== null;
  const snapshotRef = useRef('');
  const pausedByEditionRef = useRef(false);
  const charts: {
    id: string;
    title: string;
    kind: ChartLayoutItem['kind'];
    description?: string;
    className?: string;
    node: React.ReactNode;
  }[] =
    data === undefined
      ? []
      : [
          {
            id: 'prospects-over-time',
            title: 'Prospects dans le temps',
            kind: 'trend',
            description: 'Cumul sur la période filtrée',
            className: 'xl:col-span-2',
            node: <ProspectsTrendChart points={data.prospectsOverTime} />,
          },
          {
            id: 'top-teleconseillers',
            title: 'Téléconseillers',
            kind: 'rank',
            description: 'Prospects apportés',
            node: <RankBarChart items={data.topCommerciaux} label="Prospects" />,
          },
          {
            id: 'top-representants',
            title: 'Représentants',
            kind: 'rank',
            description: 'Prospects rattachés',
            node: <RankBarChart items={data.topRepresentants} label="Prospects" />,
          },
          {
            id: 'by-departement',
            title: 'Par département',
            kind: 'category',
            description: 'Répartition géographique',
            node: <CategoryBarChart items={data.parDepartement} label="Prospects" />,
          },
          {
            id: 'by-bank',
            title: 'Par banque',
            kind: 'share',
            description: 'Domiciliation déclarée',
            node: <ShareDoughnutChart items={data.parBanque} />,
          },
          {
            id: 'by-syndicat',
            title: 'Par syndicat',
            kind: 'share',
            description: 'Appartenance déclarée',
            className: 'xl:col-span-2',
            node: <ShareDoughnutChart items={data.parSyndicat} />,
          },
        ];
  const currentLayout: ChartLayoutItem[] = editing
    ? draft
    : (layoutQuery.data?.widgets.map((widget: { id: string; visible: boolean }) => ({
        id: widget.id,
        label: charts.find((chart) => chart.id === widget.id)?.title ?? widget.id,
        kind: charts.find((chart) => chart.id === widget.id)?.kind ?? 'category',
        visible: widget.visible,
      })) ??
      charts.map((chart) => ({
        id: chart.id,
        label: chart.title,
        kind: chart.kind,
        visible: true,
      })));
  const orderedCharts = currentLayout
    .map((entry) => charts.find((chart) => chart.id === entry.id))
    .filter((chart): chart is (typeof charts)[number] => chart !== undefined)
    .filter((chart) => currentLayout.find((entry) => entry.id === chart.id)?.visible !== false);
  const saveMutation = useMutation({
    mutationFn: (items: ChartLayoutItem[]) =>
      saveStatsLayout(
        'dashboard',
        items.map(({ id, visible }) => ({ id, visible })),
      ),
    onSuccess: async () => {
      setDraft(null);
      if (pausedByEditionRef.current) {
        live.togglePause();
        pausedByEditionRef.current = false;
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.statsLayout('dashboard') });
    },
  });
  const resetMutation = useMutation({
    mutationFn: () => resetStatsLayout('dashboard'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.statsLayout('dashboard') });
    },
  });

  useEffect(() => {
    if (editing || layoutQuery.data === undefined) return;
    snapshotRef.current = JSON.stringify(layoutQuery.data.widgets);
  }, [editing, layoutQuery.data]);

  function enterEdition(): void {
    const source: ChartLayoutItem[] =
      layoutQuery.data?.widgets.map((widget: { id: string; visible: boolean }) => ({
        id: widget.id,
        label: charts.find((chart) => chart.id === widget.id)?.title ?? widget.id,
        kind: charts.find((chart) => chart.id === widget.id)?.kind ?? 'category',
        visible: widget.visible,
      })) ??
      charts.map((chart) => ({
        id: chart.id,
        label: chart.title,
        kind: chart.kind,
        visible: true,
      }));
    snapshotRef.current = JSON.stringify(source.map(({ id, visible }) => ({ id, visible })));
    setDraft(source);
    if (!live.paused) {
      live.togglePause();
      pausedByEditionRef.current = true;
    }
  }

  function cancelEdition(): void {
    setDraft(null);
    if (pausedByEditionRef.current) {
      live.togglePause();
      pausedByEditionRef.current = false;
    }
  }

  const dirty =
    editing &&
    JSON.stringify(draft.map(({ id, visible }) => ({ id, visible }))) !== snapshotRef.current;

  return (
    <div className="flex flex-col gap-6">
      <FiltersBar />

      <div className="flex flex-wrap items-center justify-end gap-3">
        {/* Le nombre exact reste à un clic : un directeur financier qui lit
            « 1,25 Mrd » doit pouvoir obtenir « 1 250 000 000 » sans quitter la
            page ni ouvrir un export. */}
        <ExactAmountsToggle />

        {/* L'indicateur porte l'état des DEUX requêtes : annoncer « En direct »
            pendant que les montants ne se rafraîchissent plus serait le pire
            mensonge de cet écran. */}
        <LiveIndicator
          state={live.stateOf(isError || funnelQuery.isError)}
          label={live.labelOf(isError || funnelQuery.isError)}
          updatedAt={hasData ? dataUpdatedAt : null}
          onTogglePause={live.togglePause}
        />
      </div>

      {/* L'ARGENT D'ABORD. Les compteurs de prospection décrivent l'effort ;
          seuls les encaissements décrivent le résultat, et une direction qui
          doit dérouler la page pour l'atteindre ne le regardera pas. */}
      {(() => {
        if (shouldShowError({ isError: funnelQuery.isError, hasData: funnel !== undefined }))
          return (
            <Card role="alert" className="px-6 py-10">
              <QueryErrorInline
                error={funnelQuery.error}
                onRetry={() => {
                  void funnelQuery.refetch();
                }}
                fallback="Les encaissements n’ont pas pu être calculés."
              />
            </Card>
          );
        return (() => {
          if (funnel === undefined) return <FunnelPanelSkeleton />;
          return <FunnelPanel funnel={funnel} />;
        })();
      })()}

      {(() => {
        if (shouldShowError({ isError, hasData }))
          return (
            <QueryErrorState
              error={error}
              onRetry={() => {
                void refetch();
              }}
              fallback="Les statistiques n’ont pas pu être calculées. Réessayez."
            />
          );
        return (() => {
          if (shouldShowSkeleton({ isPending, hasData }) || data === undefined)
            return <DashboardChartsSkeleton />;
          return (
            <>
              <KpiCards kpis={data.kpis} />
              {editing ? (
                <ChartOrganizer
                  title="Organiser les graphiques"
                  items={draft}
                  onAdd={(id) => {
                    setDraft(
                      (current) =>
                        current?.map((item) =>
                          item.id === id ? { ...item, visible: true } : item,
                        ) ?? current,
                    );
                  }}
                  onRemove={(id) => {
                    setDraft(
                      (current) =>
                        current?.map((item) =>
                          item.id === id ? { ...item, visible: false } : item,
                        ) ?? current,
                    );
                  }}
                  onMove={(id, direction) => {
                    setDraft((current) => {
                      if (current === null) return current;
                      const index = current.findIndex((item) => item.id === id);
                      const next = index + direction;
                      if (index < 0 || next < 0 || next >= current.length) return current;
                      const copy = [...current];
                      const [picked] = copy.splice(index, 1);
                      if (picked === undefined) return current;
                      copy.splice(next, 0, picked);
                      return copy;
                    });
                  }}
                  onReset={() => {
                    setDraft(
                      charts.map((chart) => ({
                        id: chart.id,
                        label: chart.title,
                        kind: chart.kind,
                        visible: true,
                      })),
                    );
                  }}
                />
              ) : null}

              <div className="grid gap-4 xl:grid-cols-2">
                {orderedCharts.map((chart) => (
                  <ChartCard
                    key={chart.id}
                    title={chart.title}
                    description={chart.description}
                    className={chart.className}
                  >
                    {chart.node}
                  </ChartCard>
                ))}
              </div>
            </>
          );
        })();
      })()}

      {/* La personnalisation est le DERNIER geste de l'écran, et le plus léger :
          on vient ici lire des chiffres, pas ranger des cartes. */}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-4">
        {layoutQuery.data !== undefined && !editing ? (
          <Button
            type="button"
            variant="ghost"
            disabled={resetMutation.isPending}
            onClick={() => {
              resetMutation.mutate();
            }}
          >
            Revenir à l’ordre par défaut
          </Button>
        ) : null}
        <BarreEdition
          editing={editing}
          dirty={dirty}
          pending={saveMutation.isPending}
          isAdmin={false}
          entryLabel="Choisir les indicateurs"
          entryVariant="ghost"
          onEnter={enterEdition}
          onSave={() => {
            if (draft !== null) saveMutation.mutate(draft);
          }}
          onCancel={cancelEdition}
          onSetDefault={() => {}}
        />
      </div>
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
