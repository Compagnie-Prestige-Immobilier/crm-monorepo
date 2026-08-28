'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIcon, HeadsetIcon, PercentIcon, TargetIcon, UsersIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { BarreEdition } from '@/components/accueil/tableau-de-bord/barre-edition';
import {
  CategoryBarChart,
  ProspectsTrendChart,
  RankBarChart,
  ShareDoughnutChart,
} from '@/components/dashboard/charts';
import { LiveIndicator } from '@/components/live/live-indicator';
import { useLive } from '@/components/live/use-live';
import { QueryErrorState } from '@/components/query-error-state';
import { AmbassadorConversionCard } from '@/components/stats/ambassador-conversion-card';
import { ChartOrganizer, type ChartLayoutItem } from '@/components/stats/chart-organizer';
import { DelaysStrip, PortfolioBlocks } from '@/components/stats/portfolio-blocks';
import {
  StatChartCard,
  StatChartsSkeleton,
  StatTile,
  StatTilesSkeleton,
} from '@/components/stats/stat-tile';
import { useProspectFilters } from '@/components/filters/use-prospect-filters';
import { Button } from '@/components/ui/button';
import {
  bestSegment,
  conversionRate,
  dailyAverage,
  fetchTeleconseilStats,
  methodRate,
  weeklyPace,
} from '@/lib/data/statistics';
import { fetchStatsLayout, resetStatsLayout, saveStatsLayout } from '@/lib/data/stats-layout';
import { formatDecimal, formatNumber, formatPercent } from '@/lib/format';
import { shouldShowError, shouldShowSkeleton } from '@/lib/live';
import { queryKeys } from '@/lib/query-keys';
import type { NamedCount } from '@/lib/types';

export function TeleconseilPanel() {
  const { filters } = useProspectFilters();
  const live = useLive();
  const queryClient = useQueryClient();

  const { data, isPending, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: queryKeys.statsTeleconseil(filters),
    queryFn: () => fetchTeleconseilStats(filters),
    refetchInterval: live.refetchInterval,
    placeholderData: keepPreviousData,
  });
  const layoutQuery = useQuery({
    queryKey: queryKeys.statsLayout('teleconseil'),
    queryFn: () => fetchStatsLayout('teleconseil'),
  });
  const [draft, setDraft] = useState<ChartLayoutItem[] | null>(null);
  const editing = draft !== null;
  const snapshotRef = useRef('');
  const pausedByEditionRef = useRef(false);

  const hasData = data !== undefined;

  if (shouldShowError({ isError, hasData })) {
    return (
      <QueryErrorState
        error={error}
        onRetry={() => {
          void refetch();
        }}
        fallback="Les statistiques n’ont pas pu être calculées. Réessayez."
      />
    );
  }

  if (shouldShowSkeleton({ isPending, hasData }) || data === undefined) {
    return (
      <div className="flex flex-col gap-6">
        <StatTilesSkeleton />
        <StatChartsSkeleton />
      </div>
    );
  }

  const conversion = conversionRate(data.totals);
  const method = methodRate({ methodTotal: data.methodTotal, prospects: data.totals.prospects });
  const pace = weeklyPace(data.totals);
  const best = bestSegment(data.parSegment);

  const statutItems: NamedCount[] = data.parStatutPhase2.map((entry) => ({
    id: entry.status,
    label: entry.label,
    value: entry.prospects,
  }));
  const methodItems: NamedCount[] = data.parMethode.map((entry) => ({
    id: entry.method,
    label: entry.label,
    value: entry.prospects,
  }));
  const segmentItems: NamedCount[] = data.parSegment.map((entry) => ({
    id: entry.segment,
    label: entry.segment,
    value: entry.prospects,
  }));
  const charts: {
    id: string;
    title: string;
    kind: ChartLayoutItem['kind'];
    stat: Parameters<typeof StatChartCard>[0]['stat'];
    description?: string;
    className?: string;
    node: React.ReactNode;
  }[] = [
    {
      id: 'prospects-over-time',
      title: 'Prospects dans le temps',
      kind: 'trend',
      stat: 'prospectsOverTime' as const,
      description: 'Cumul sur la période filtrée',
      className: 'xl:col-span-2',
      node: <ProspectsTrendChart points={data.overTime} />,
    },
    {
      id: 'top-teleconseillers',
      title: 'Téléconseillers',
      kind: 'rank',
      stat: 'topTeleconseillers' as const,
      node: <RankBarChart items={data.topTeleconseillers} label="Prospects" />,
    },
    {
      id: 'conversion-teleconseillers',
      title: 'Taux de conversion par téléconseiller',
      kind: 'rank',
      stat: 'conversionRate' as const,
      node: <RankBarChart items={data.topTeleconseillerConversion} label="Conversion (%)" />,
    },
    {
      id: 'phase2-status',
      title: 'Statuts de phase 3 · Conversion',
      kind: 'category',
      stat: 'parStatutPhase2' as const,
      node: <CategoryBarChart items={statutItems} label="Prospects" />,
    },
    {
      id: 'enrollment-methods',
      title: 'Méthodes d’enrôlement',
      kind: 'share',
      stat: 'parMethode' as const,
      node: <ShareDoughnutChart items={methodItems} />,
    },
    {
      id: 'segments',
      title: 'Segments BDD',
      kind: 'category',
      stat: 'parSegment' as const,
      node: <CategoryBarChart items={segmentItems} label="Prospects" />,
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
        'teleconseil',
        items.map(({ id, visible }) => ({ id, visible })),
      ),
    onSuccess: async () => {
      setDraft(null);
      if (pausedByEditionRef.current) {
        live.togglePause();
        pausedByEditionRef.current = false;
      }
      await queryClient.invalidateQueries({ queryKey: queryKeys.statsLayout('teleconseil') });
    },
  });
  const resetMutation = useMutation({
    mutationFn: () => resetStatsLayout('teleconseil'),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.statsLayout('teleconseil') });
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
      <div className="flex flex-wrap items-center justify-end gap-2">
        <LiveIndicator
          state={live.stateOf(isError)}
          label={live.labelOf(isError)}
          updatedAt={dataUpdatedAt}
          onTogglePause={live.togglePause}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          index={0}
          stat="prospects"
          label="Prospects"
          value={data.totals.prospects}
          hint={`${formatNumber(data.totals.prospects7Jours)} sur 7 jours`}
          icon={UsersIcon}
        />
        <StatTile
          index={1}
          stat="conversionRate"
          label="Taux de conversion"
          value={`${formatDecimal(method)} %`}
          hint={`${formatNumber(data.methodTotal)} méthodes obtenues`}
          icon={TargetIcon}
          tone="success"
        />
        <StatTile
          index={2}
          stat="methodRate"
          label="Convertis"
          value={formatNumber(data.totals.converti)}
          hint={`${formatDecimal(conversion)} % du total`}
          icon={PercentIcon}
        />
        <StatTile
          index={3}
          stat="dailyAverage"
          label="Saisies par jour"
          value={formatDecimal(dailyAverage(data.totals.prospects30Jours))}
          hint={`${formatPercent(pace)} sur 7 jours`}
          icon={ActivityIcon}
          tone={pace < 0 ? 'destructive' : 'default'}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          index={0}
          stat="teleconseillersActifs"
          label="Téléconseillers actifs"
          value={data.totals.teleconseillersActifs}
          icon={HeadsetIcon}
        />
        <StatTile
          index={1}
          stat="representants"
          label="Représentants"
          value={data.totals.representants}
          icon={UsersIcon}
        />
        <StatTile
          index={2}
          stat="departementsCouverts"
          label="Départements couverts"
          value={data.totals.departementsCouverts}
          icon={TargetIcon}
        />
        <StatTile
          index={3}
          stat="parSegment"
          label="Segment le plus réceptif"
          value={best?.segment ?? 'Aucun'}
          hint={
            best === null
              ? 'Aucun prospect sur la sélection'
              : `${formatNumber(best.methodObtained)} méthodes sur ${formatNumber(best.prospects)}`
          }
          icon={PercentIcon}
        />
      </div>

      {editing ? (
        <ChartOrganizer
          title="Organiser les graphiques"
          items={draft}
          onAdd={(id) => {
            setDraft(
              (current) =>
                current?.map((item) => (item.id === id ? { ...item, visible: true } : item)) ??
                current,
            );
          }}
          onRemove={(id) => {
            setDraft(
              (current) =>
                current?.map((item) => (item.id === id ? { ...item, visible: false } : item)) ??
                current,
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
          <StatChartCard
            key={chart.id}
            stat={chart.stat}
            title={chart.title}
            description={chart.description}
            className={chart.className}
          >
            {chart.node}
          </StatChartCard>
        ))}
      </div>

      {/* Les blocs ajoutés vivent SOUS les graphiques historiques et dans leur
          propre composant : ils portent chacun leur requête, et faire dépendre
          des calculs lourds (médianes, cohortes hebdomadaires) du cycle de
          rafraîchissement continu ci-dessus multiplierait la charge SQL pour
          des chiffres qui ne bougent pas à la minute. */}
      <DelaysStrip />
      <AmbassadorConversionCard />
      <PortfolioBlocks />

      {/* La personnalisation est le DERNIER geste de l'écran, et le plus léger :
          on vient ici lire des chiffres, pas ranger des cartes. */}
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border pt-4">
        {layoutQuery.data?.updatedAt !== null ? (
          <p className="mr-auto text-[0.75rem] text-muted-foreground">
            Organisation enregistrée sur le serveur.
          </p>
        ) : null}
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
