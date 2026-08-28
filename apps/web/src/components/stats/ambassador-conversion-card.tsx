'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useProspectFilters } from '@/components/filters/use-prospect-filters';
import { QueryErrorInline } from '@/components/query-error-state';
import { StatInfo } from '@/components/stats/stat-info';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchAmbassadorConversion } from '@/lib/data/advanced-stats';
import { formatNumber, formatRate } from '@/lib/format';
import { shouldShowError } from '@/lib/live';
import { queryKeys } from '@/lib/query-keys';

const TITRE = 'Représentants devenus ambassadeurs';

export function AmbassadorConversionCard() {
  const { filters } = useProspectFilters();

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: queryKeys.statsAmbassadeurs(filters),
    queryFn: () => fetchAmbassadorConversion(filters),
    placeholderData: keepPreviousData,
  });

  const showError = shouldShowError({ isError, hasData: data !== undefined });

  return (
    <Card className="animate-rise">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-[1.0625rem]">
          {TITRE}
          <StatInfo stat="ambassadorConversion" label={TITRE} />
        </CardTitle>
        <CardDescription>
          Bascules datées du jour de la décision, pas du jour de leur enregistrement.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {(() => {
          if (showError)
            return (
              <QueryErrorInline
                error={error}
                onRetry={() => {
                  void refetch();
                }}
                fallback="Le taux de conversion en ambassadeurs n’a pas pu être calculé."
              />
            );
          return (() => {
            if (isPending || data === undefined)
              return <Skeleton className="h-24 w-full" aria-hidden="true" />;
            return (() => {
              if (data.conversionRate === null)
                return (
                  <p className="text-[0.875rem] text-muted-foreground">
                    Aucune relation renseignée sur la période. Renseignez le statut des
                    représentants appelés pour que le taux existe.
                  </p>
                );
              return (
                <>
                  <p className="font-display text-[2rem] font-[800] leading-none tracking-[-0.02em] tabular-nums text-success">
                    {formatRate(data.conversionRate)}
                  </p>
                  <p className="text-[0.875rem] tabular-nums">
                    {formatNumber(data.ambassadors)} ambassadeurs sur {formatNumber(data.contacted)}{' '}
                    représentants travaillés sur la période.
                  </p>
                  {data.reverted > 0 ? (
                    <p className="text-[0.8125rem] text-muted-foreground tabular-nums">
                      {formatNumber(data.reverted)} d’entre eux ne sont plus ambassadeurs
                      aujourd’hui. La bascule reste comptée : elle a eu lieu, et elle est datée.
                    </p>
                  ) : null}
                </>
              );
            })();
          })();
        })()}

        {/* Le chiffre a l'air d'un taux sur l'annuaire ; il ne porte que sur la
            population travaillée, et ce qui en est exclu doit se lire ici. */}
        {!showError && data !== undefined && data.untracked > 0 ? (
          <p className="text-[0.8125rem] text-warning tabular-nums">
            {formatNumber(data.untracked)} représentants de l’annuaire n’ont aucune trace de
            relation : ils sont hors du calcul, au numérateur comme au dénominateur.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
