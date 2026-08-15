'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ActivityIcon, HeadsetIcon, PercentIcon, TargetIcon, UsersIcon } from 'lucide-react';

import {
  CategoryBarChart,
  ProspectsTrendChart,
  RankBarChart,
  ShareDoughnutChart,
} from '@/components/dashboard/charts';
import { LiveIndicator } from '@/components/live/live-indicator';
import { useLive } from '@/components/live/use-live';
import { QueryErrorState } from '@/components/query-error-state';
import { DelaysStrip, PortfolioBlocks } from '@/components/stats/portfolio-blocks';
import {
  StatChartCard,
  StatChartsSkeleton,
  StatTile,
  StatTilesSkeleton,
} from '@/components/stats/stat-tile';
import { useProspectFilters } from '@/components/filters/use-prospect-filters';
import {
  bestSegment,
  conversionRate,
  dailyAverage,
  fetchTeleconseilStats,
  methodRate,
  weeklyPace,
} from '@/lib/data/statistics';
import { formatDecimal, formatNumber, formatPercent } from '@/lib/format';
import { shouldShowError, shouldShowSkeleton } from '@/lib/live';
import { queryKeys } from '@/lib/query-keys';
import type { NamedCount } from '@/lib/types';

/**
 * Volet téléconseil.
 *
 * Il prend le MÊME objet de filtre que la liste des prospects : un chiffre lu
 * ici décrit exactement la population du tableau. Deux jeux de critères
 * finiraient toujours par afficher deux totaux différents pour la même chose.
 */
export function TeleconseilPanel() {
  const { filters } = useProspectFilters();
  const live = useLive();

  const { data, isPending, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: queryKeys.statsTeleconseil(filters),
    queryFn: () => fetchTeleconseilStats(filters),
    refetchInterval: live.refetchInterval,
    placeholderData: keepPreviousData,
  });

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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-end">
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
          value={`${formatDecimal(conversion)} %`}
          hint={`${formatNumber(data.totals.converti)} convertis`}
          icon={TargetIcon}
          tone="success"
        />
        <StatTile
          index={2}
          stat="methodRate"
          label="Méthode obtenue"
          value={`${formatDecimal(method)} %`}
          hint={`${formatNumber(data.methodTotal)} prospects`}
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

      <div className="grid gap-4 xl:grid-cols-2">
        <StatChartCard
          stat="prospectsOverTime"
          title="Prospects dans le temps"
          description="Cumul sur la période filtrée"
          className="xl:col-span-2"
        >
          <ProspectsTrendChart points={data.overTime} />
        </StatChartCard>

        <StatChartCard stat="topTeleconseillers" title="Téléconseillers">
          <RankBarChart items={data.topTeleconseillers} label="Prospects" />
        </StatChartCard>

        <StatChartCard stat="parStatutPhase2" title="Statuts de phase 2">
          <CategoryBarChart items={statutItems} label="Prospects" />
        </StatChartCard>

        <StatChartCard stat="parMethode" title="Méthodes d’enrôlement">
          <ShareDoughnutChart items={methodItems} />
        </StatChartCard>

        <StatChartCard stat="parSegment" title="Segments BDD">
          <CategoryBarChart items={segmentItems} label="Prospects" />
        </StatChartCard>
      </div>

      {/* Les blocs ajoutés vivent SOUS les graphiques historiques et dans leur
          propre composant : ils portent chacun leur requête, et faire dépendre
          des calculs lourds (médianes, cohortes hebdomadaires) du cycle de
          rafraîchissement continu ci-dessus multiplierait la charge SQL pour
          des chiffres qui ne bougent pas à la minute. */}
      <DelaysStrip />
      <PortfolioBlocks />
    </div>
  );
}
