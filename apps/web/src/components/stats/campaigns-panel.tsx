'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CalendarClockIcon, PercentIcon, PhoneCallIcon, TargetIcon } from 'lucide-react';

import { CategoryBarChart, RankBarChart } from '@/components/dashboard/charts';
import { useProspectFilters } from '@/components/filters/use-prospect-filters';
import { LiveIndicator } from '@/components/live/live-indicator';
import { useLive } from '@/components/live/use-live';
import { QueryErrorInline, QueryErrorState } from '@/components/query-error-state';
import {
  StatChartCard,
  StatChartsSkeleton,
  StatTile,
  StatTilesSkeleton,
} from '@/components/stats/stat-tile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  closedPerCommercial,
  closedPerDayTotals,
  estimatedEndLabel,
  fetchCampaignPilotage,
  fetchDataQuality,
} from '@/lib/data/advanced-stats';
import {
  formatDecimal,
  formatNumber,
  formatRate,
  formatRateOrNone,
  formatShortDate,
} from '@/lib/format';
import { shouldShowError } from '@/lib/live';
import { queryKeys } from '@/lib/query-keys';
import type { NamedCount } from '@/lib/types';

export function CampaignsPanel() {
  const { filters } = useProspectFilters();
  const live = useLive();

  const pilotage = useQuery({
    queryKey: queryKeys.statsCampagnes(filters),
    queryFn: () => fetchCampaignPilotage(filters),
    refetchInterval: live.refetchInterval,
    placeholderData: keepPreviousData,
  });

  const quality = useQuery({
    queryKey: queryKeys.statsQualite(filters),
    queryFn: () => fetchDataQuality(filters),
    refetchInterval: live.refetchInterval,
    placeholderData: keepPreviousData,
  });

  if (pilotage.isError) {
    return (
      <QueryErrorState
        error={pilotage.error}
        onRetry={() => {
          void pilotage.refetch();
        }}
        fallback="Le pilotage de campagne n’a pas pu être calculé. Réessayez."
      />
    );
  }

  if (pilotage.data === undefined) {
    return (
      <div className="flex flex-col gap-6">
        <StatTilesSkeleton />
        <StatChartsSkeleton count={2} />
      </div>
    );
  }

  const data = pilotage.data;
  const perDay: NamedCount[] = closedPerDayTotals(data.closedPerDay).map((point) => ({
    id: point.day,
    label: formatShortDate(point.day),
    value: point.done,
  }));
  const perCommercial = closedPerCommercial(data.closedPerDay);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <LiveIndicator
          state={live.stateOf(pilotage.isError)}
          label={live.labelOf(pilotage.isError)}
          updatedAt={pilotage.dataUpdatedAt}
          onTogglePause={live.togglePause}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          index={0}
          stat="campaignContactRate"
          label="Fiches touchées"
          value={data.contactRate === null ? 'Aucune fiche' : formatRate(data.contactRate)}
          hint={`${formatNumber(data.tasksContacted)} sur ${formatNumber(data.tasks)}`}
          icon={PhoneCallIcon}
        />
        <StatTile
          index={1}
          stat="campaignReachRate"
          label="Joignabilité"
          value={data.reachRate === null ? 'Aucun appel' : formatRate(data.reachRate)}
          hint={`${formatNumber(data.reachableAttempts)} appels aboutis sur ${formatNumber(data.attempts)}`}
          icon={PercentIcon}
          tone={
            data.reachRate !== null && data.reachRate < 50 && data.attempts > 0
              ? 'destructive'
              : 'default'
          }
        />
        <StatTile
          index={2}
          stat="campaignAttemptsPerMethod"
          label="Appels par méthode"
          value={
            data.methodsObtained === 0
              ? 'Aucune méthode'
              : formatDecimal(data.attemptsPerMethodObtained)
          }
          hint={`${formatNumber(data.methodsObtained)} méthodes obtenues`}
          icon={TargetIcon}
        />
        <StatTile
          index={3}
          stat="campaignRemaining"
          label="Reste à faire"
          value={data.remaining}
          hint={
            <>
              Cadence : {formatDecimal(data.observedPace)} par jour · fin{' '}
              {estimatedEndLabel(data.estimatedEndDate, data.remaining)}
            </>
          }
          icon={CalendarClockIcon}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <StatChartCard
          stat="campaignClosedPerDay"
          title="Fiches clôturées par jour"
          description="Cadence réelle, tous téléconseillers confondus"
          className="xl:col-span-2"
        >
          <CategoryBarChart items={perDay} label="Fiches clôturées" />
        </StatChartCard>

        <StatChartCard
          stat="campaignClosedPerCommercial"
          title="Par téléconseiller"
          description="Fiches abouties, pas appels passés"
        >
          <RankBarChart items={perCommercial} label="Fiches clôturées" />
        </StatChartCard>

        <QualityCard
          rows={quality.data?.representants ?? []}
          badRate={quality.data?.badRate ?? null}
          attempts={quality.data?.attempts ?? 0}
          isPending={quality.isPending}
          showError={shouldShowError({
            isError: quality.isError,
            hasData: quality.data !== undefined,
          })}
          error={quality.error}
          onRetry={() => {
            void quality.refetch();
          }}
        />
      </div>
    </div>
  );
}

function QualityCard({
  rows,
  badRate,
  attempts,
  isPending,
  showError,
  error,
  onRetry,
}: {
  rows: readonly {
    id: string;
    label: string;
    attempts: number;
    unreachable: number;
    wrongNumber: number;
    badRate: number | null;
  }[];
  badRate: number | null;
  attempts: number;
  isPending: boolean;
  showError: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  return (
    <Card className="animate-rise">
      <CardHeader>
        <CardTitle className="text-[1.0625rem]">Qualité des numéros</CardTitle>
        <CardDescription>
          {/* « Aucun appel enregistré » est une AFFIRMATION sur l'activité. Elle
              ne doit sortir que d'une mesure qui a abouti. */}
          {(() => {
            if (showError) return 'Qualité indisponible.';
            return (() => {
              if (isPending) return 'Calcul en cours…';
              return (() => {
                if (badRate === null) return 'Aucun appel enregistré sur la sélection.';
                return `${formatRate(badRate)} de numéros inexploitables sur ${formatNumber(attempts)} appels.`;
              })();
            })();
          })()}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {(() => {
          if (showError)
            return (
              <div className="px-5 pb-5">
                <QueryErrorInline
                  error={error}
                  onRetry={onRetry}
                  fallback="La qualité des numéros n’a pas pu être calculée."
                />
              </div>
            );
          return (() => {
            if (rows.length === 0)
              return (
                <p className="px-5 pb-5 text-[0.875rem] text-muted-foreground">
                  {isPending ? '' : 'Aucun appel enregistré sur la sélection.'}
                </p>
              );
            return (
              <div className="max-h-64 overflow-y-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Représentant</TableHead>
                      <TableHead className="text-right">Appels</TableHead>
                      <TableHead className="text-right">Injoignables</TableHead>
                      <TableHead className="text-right">Faux numéros</TableHead>
                      <TableHead className="text-right">Part</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.slice(0, 20).map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-[600]">{row.label}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(row.attempts)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(row.unreachable)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatNumber(row.wrongNumber)}
                        </TableCell>
                        <TableCell
                          className={`text-right tabular-nums ${row.badRate !== null && row.badRate >= 50 ? 'font-[700] text-destructive' : ''}`}
                        >
                          {formatRateOrNone(row.badRate)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            );
          })();
        })()}
      </CardContent>
    </Card>
  );
}
