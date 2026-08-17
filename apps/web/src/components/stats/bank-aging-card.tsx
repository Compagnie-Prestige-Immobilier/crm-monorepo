'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { QueryErrorInline } from '@/components/query-error-state';
import { StatInfo } from '@/components/stats/stat-info';
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
import { EMPTY_FILTERS } from '@/lib/filters';
import { fetchBankAging, formatDelayDays } from '@/lib/data/advanced-stats';
import { formatNumber, formatRateOrNone } from '@/lib/format';
import { shouldShowError } from '@/lib/live';
import { queryKeys } from '@/lib/query-keys';

export function BankAgingCard() {
  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.statsVieillissement(EMPTY_FILTERS),
    queryFn: () => fetchBankAging(EMPTY_FILTERS),
    placeholderData: keepPreviousData,
  });

  const hasData = data !== undefined;
  const showError = shouldShowError({ isError, hasData });

  return (
    <Card className="animate-rise">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[1.0625rem]">
          Ancienneté des dossiers en cours
          <StatInfo stat="bankAging" label="Ancienneté des dossiers en cours" />
        </CardTitle>
        <CardDescription>
          {showError
            ? 'Ancienneté indisponible.'
            : isPending || !hasData
              ? 'Calcul en cours…'
              : `${formatNumber(data.total)} dossier${data.total > 1 ? 's' : ''} encore ouvert${data.total > 1 ? 's' : ''}. Les dossiers encaissés ou rejetés sont sortis du portefeuille.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {showError ? (
          <QueryErrorInline
            error={error}
            onRetry={() => {
              void refetch();
            }}
            fallback="L’ancienneté des dossiers n’a pas pu être calculée."
          />
        ) : data === undefined ? (
          <Skeleton className="h-40 w-full" aria-hidden="true" />
        ) : data.total === 0 ? (
          <p className="text-[0.875rem] text-muted-foreground">
            Aucun dossier en cours : rien ne vieillit.
          </p>
        ) : (
          <>
            <ul className="grid gap-2 sm:grid-cols-5">
              {data.buckets.map((bucket) => (
                <li key={bucket.bucket} className="rounded-md border border-border p-3">
                  <p className="text-[0.75rem] text-muted-foreground">{bucket.label}</p>
                  <p className="mt-0.5 text-[1.125rem] font-[700] tabular-nums">
                    {formatNumber(bucket.dossiers)}
                  </p>
                  <p className="text-[0.75rem] text-muted-foreground tabular-nums">
                    {formatRateOrNone(bucket.share)}
                  </p>
                </li>
              ))}
            </ul>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Étape</TableHead>
                    <TableHead className="text-right">Dossiers</TableHead>
                    <TableHead className="text-right">Part</TableHead>
                    <TableHead className="text-right">Stationnement médian</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.stages.map((stage) => (
                    <TableRow key={stage.stageId}>
                      <TableCell className="font-[600]">{stage.label}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(stage.dossiers)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatRateOrNone(stage.share)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatDelayDays(stage.medianStationDays)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
