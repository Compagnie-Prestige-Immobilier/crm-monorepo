'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { HourglassIcon } from 'lucide-react';

import { RankBarChart, ShareDoughnutChart } from '@/components/dashboard/charts';
import { useProspectFilters } from '@/components/filters/use-prospect-filters';
import { QueryErrorInline } from '@/components/query-error-state';
import { StatChartCard, StatTile } from '@/components/stats/stat-tile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  fetchAnalyticsDelays,
  fetchDepartementYield,
  fetchOriginBreakdown,
  fetchRepresentantProductivity,
  fetchWeeklyCohorts,
  formatDelayDays,
} from '@/lib/data/advanced-stats';
import { groupTail } from '@/lib/data/series';
import { shouldShowError } from '@/lib/live';
import { formatNumber, formatRateOrNone, formatShortDate } from '@/lib/format';
import { formatXof } from '@/lib/money';
import { queryKeys } from '@/lib/query-keys';
import type { NamedCount } from '@/lib/types';

export function DelaysStrip() {
  const { filters } = useProspectFilters();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.statsDelais(filters),
    queryFn: () => fetchAnalyticsDelays(filters),
    placeholderData: keepPreviousData,
  });

  if (shouldShowError({ isError, hasData: data !== undefined })) {
    return (
      <QueryErrorInline
        error={error}
        onRetry={() => {
          void refetch();
        }}
        fallback="Les délais n’ont pas pu être calculés."
      />
    );
  }

  if (isPending || data === undefined) {
    return (
      <div className="grid gap-4 sm:grid-cols-3" aria-hidden="true">
        {[0, 1, 2].map((index) => (
          <Skeleton key={index} className="h-28 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {data.legs.map((leg, index) => (
        <StatTile
          key={leg.leg}
          index={index}
          stat="delayLegs"
          label={leg.label}
          value={formatDelayDays(leg.medianDays)}
          hint={
            leg.sample === 0
              ? 'Aucun couple de dates exploitable'
              : `${formatNumber(leg.sample)} mesures · 9 sur 10 sous ${formatDelayDays(leg.p90Days)}`
          }
          icon={HourglassIcon}
        />
      ))}
    </div>
  );
}

export function PortfolioBlocks() {
  const { filters } = useProspectFilters();

  const cohorts = useQuery({
    queryKey: queryKeys.statsCohortes(filters),
    queryFn: () => fetchWeeklyCohorts(filters),
    placeholderData: keepPreviousData,
  });

  const productivity = useQuery({
    queryKey: queryKeys.statsRepresentants(filters),
    queryFn: () => fetchRepresentantProductivity(filters),
    placeholderData: keepPreviousData,
  });

  const yields = useQuery({
    queryKey: queryKeys.statsRendement(filters),
    queryFn: () => fetchDepartementYield(filters),
    placeholderData: keepPreviousData,
  });

  const origins = useQuery({
    queryKey: queryKeys.statsProvenance(filters),
    queryFn: () => fetchOriginBreakdown(filters),
    placeholderData: keepPreviousData,
  });

  const yieldItems: NamedCount[] = groupTail(
    (yields.data?.items ?? []).flatMap((row) =>
      row.conversionRate === null
        ? []
        : [{ id: row.id, label: row.label, value: row.conversionRate }],
    ),
  );

  const originItems: NamedCount[] = (origins.data?.items ?? []).map((row) => ({
    id: row.origin ?? 'terrain',
    label: row.label,
    value: row.prospects,
  }));

  const dormant = (productivity.data?.items ?? []).filter((row) => row.dormant);

  const yieldsFailed = shouldShowError({
    isError: yields.isError,
    hasData: yields.data !== undefined,
  });
  const originsFailed = shouldShowError({
    isError: origins.isError,
    hasData: origins.data !== undefined,
  });
  const cohortsFailed = shouldShowError({
    isError: cohorts.isError,
    hasData: cohorts.data !== undefined,
  });
  const productivityFailed = shouldShowError({
    isError: productivity.isError,
    hasData: productivity.data !== undefined,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-2">
        <StatChartCard
          stat="departementYield"
          title="Rendement par département"
          description="Part des prospects allés jusqu’à l’encaissement"
        >
          {yieldsFailed ? (
            <QueryErrorInline
              error={yields.error}
              onRetry={() => {
                void yields.refetch();
              }}
              fallback="Le rendement par département n’a pas pu être calculé."
            />
          ) : (
            <RankBarChart items={yieldItems} label="Conversion (%)" />
          )}
        </StatChartCard>

        <StatChartCard
          stat="originBreakdown"
          title="Provenance des fiches"
          description="Tournée terrain ou demande hors base"
        >
          {originsFailed ? (
            <QueryErrorInline
              error={origins.error}
              onRetry={() => {
                void origins.refetch();
              }}
              fallback="La provenance des fiches n’a pas pu être calculée."
            />
          ) : (
            <ShareDoughnutChart items={originItems} />
          )}
        </StatChartCard>
      </div>

      <Card className="animate-rise">
        <CardHeader>
          <CardTitle className="text-[1.0625rem]">Cohortes hebdomadaires</CardTitle>
          <CardDescription>
            Chaque ligne suit UNE semaine d’entrée jusqu’à l’encaissement. C’est la seule mesure qui
            distingue une amélioration réelle d’un effet de volume.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {(() => {
            if (cohortsFailed)
              return (
                <div className="px-5 pb-5">
                  <QueryErrorInline
                    error={cohorts.error}
                    onRetry={() => {
                      void cohorts.refetch();
                    }}
                    fallback="Les cohortes n’ont pas pu être calculées."
                  />
                </div>
              );
            return (() => {
              if (cohorts.data === undefined)
                return (
                  <div className="px-5 pb-5" aria-hidden="true">
                    <Skeleton className="h-40 w-full" />
                  </div>
                );
              return (() => {
                if (cohorts.data.items.length === 0)
                  return (
                    <p className="px-5 pb-5 text-[0.875rem] text-muted-foreground">
                      Aucun prospect sur la sélection.
                    </p>
                  );
                return (
                  <div className="max-h-72 overflow-auto scrollbar-thin">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Semaine</TableHead>
                          <TableHead className="text-right">Prospects</TableHead>
                          <TableHead className="text-right">Méthode</TableHead>
                          <TableHead className="text-right">Dossiers</TableHead>
                          <TableHead className="text-right">Encaissés</TableHead>
                          <TableHead className="text-right">Montant</TableHead>
                          <TableHead className="text-right">Conversion</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {cohorts.data.items.map((week) => (
                          <TableRow key={week.week}>
                            <TableCell className="font-[600] tabular-nums">
                              <time dateTime={week.week}>{formatShortDate(week.week)}</time>
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNumber(week.prospects)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNumber(week.methodObtained)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNumber(week.cases)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNumber(week.cashed)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatXof(week.cashedAmountXof)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatRateOrNone(week.conversionRate)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                );
              })();
            })();
          })()}
        </CardContent>
      </Card>

      <Card className="animate-rise">
        <CardHeader>
          <CardTitle className="text-[1.0625rem]">Productivité des représentants</CardTitle>
          <CardDescription>
            {(() => {
              if (productivityFailed) return 'Productivité indisponible.';
              return (() => {
                if (productivity.data === undefined) return 'Calcul en cours…';
                return `${formatNumber(dormant.length)} représentant${dormant.length > 1 ? 's' : ''} sans aucun apport depuis ${formatNumber(productivity.data.dormantDays)} jours.`;
              })();
            })()}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {(() => {
            if (productivityFailed)
              return (
                <div className="px-5 pb-5">
                  <QueryErrorInline
                    error={productivity.error}
                    onRetry={() => {
                      void productivity.refetch();
                    }}
                    fallback="La productivité des représentants n’a pas pu être calculée."
                  />
                </div>
              );
            return (() => {
              if (productivity.data === undefined)
                return (
                  <div className="px-5 pb-5" aria-hidden="true">
                    <Skeleton className="h-40 w-full" />
                  </div>
                );
              return (() => {
                if (productivity.data.items.length === 0)
                  return (
                    <p className="px-5 pb-5 text-[0.875rem] text-muted-foreground">
                      Aucun représentant sur la sélection.
                    </p>
                  );
                return (
                  <div className="max-h-72 overflow-auto scrollbar-thin">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Représentant</TableHead>
                          <TableHead>Département</TableHead>
                          <TableHead className="text-right">Prospects</TableHead>
                          <TableHead className="text-right">Méthode</TableHead>
                          <TableHead className="text-right">Conversion</TableHead>
                          <TableHead>Dernier apport</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {productivity.data.items.map((row) => (
                          <TableRow key={row.id}>
                            <TableCell className="font-[600]">{row.label}</TableCell>
                            <TableCell className="text-muted-foreground">
                              {row.departementName}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNumber(row.prospects)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatNumber(row.methodObtained)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatRateOrNone(row.conversionRate)}
                            </TableCell>
                            <TableCell
                              className={row.dormant ? 'text-warning' : 'text-muted-foreground'}
                            >
                              {row.lastProspectAt === null ? (
                                'Jamais'
                              ) : (
                                <time dateTime={row.lastProspectAt}>
                                  {formatShortDate(row.lastProspectAt)}
                                </time>
                              )}
                              {row.dormant ? ' · dormant' : ''}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                );
              })();
            })();
          })()}
        </CardContent>
      </Card>
    </div>
  );
}
