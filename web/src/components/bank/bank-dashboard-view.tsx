'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { BanknoteIcon, ClockIcon, FolderOpenIcon, PercentIcon } from 'lucide-react';

import {
  BankRankChart,
  BankShareChart,
  CashingsOverTimeChart,
  MeanDelayChart,
  type ClickableSlice,
} from '@/components/bank/bank-charts';
import { BankExportMenu } from '@/components/bank/bank-export-menu';
import { Kpi } from '@/components/bank/bank-kpi';
import { BankPilotage } from '@/components/bank/bank-pilotage';

import { LiveIndicator } from '@/components/live/live-indicator';
import { useLive } from '@/components/live/use-live';
import { BankFiltersBar } from '@/components/bank/bank-filters-bar';
import { useBankFilters } from '@/components/bank/use-bank-filters';
import { ChartCard } from '@/components/dashboard/chart-card';
import { EmptyChart } from '@/components/dashboard/empty-chart';
import { QueryErrorState } from '@/components/query-error-state';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { bankBasePath } from '@/lib/bank-filters';
import { fetchBankAnalytics } from '@/lib/data/bank-cases';
import { formatDecimal, formatNumber } from '@/lib/format';
import { shouldShowError, shouldShowSkeleton } from '@/lib/live';
import { ExactAmountsToggle, MoneyText } from '@/components/money/exact-amounts';
import { formatXof } from '@/lib/money';
import { queryKeys } from '@/lib/query-keys';
import type { FilterOption, Projet } from '@/lib/types';

export function BankDashboardView({ projet }: { projet: Projet }) {
  const router = useRouter();
  const { filters, hrefWith } = useBankFilters(projet);
  const live = useLive();

  const { data, isPending, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: queryKeys.bankAnalytics(filters),
    queryFn: () => fetchBankAnalytics(filters),
    refetchInterval: live.refetchInterval,
    placeholderData: keepPreviousData,
  });

  const hasData = data !== undefined;

  const drillTo =
    (patch: Parameters<typeof hrefWith>[0]): (() => void) =>
    () => {
      router.push(hrefWith(patch, `${bankBasePath(projet)}/dossiers`));
    };

  const agentOptions: FilterOption[] = (data?.byAgent ?? []).map((agent) => ({
    value: agent.agentId,
    label: agent.label,
    hint: `${formatNumber(agent.cashed)} encaissés`,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <ExactAmountsToggle />
          <LiveIndicator
            state={live.stateOf(isError)}
            label={live.labelOf(isError)}
            updatedAt={hasData ? dataUpdatedAt : null}
            onTogglePause={live.togglePause}
          />
        </div>
        <BankExportMenu filters={filters} />
      </div>

      <BankFiltersBar agentOptions={agentOptions} />

      {(() => {
        if (shouldShowError({ isError, hasData }))
          return (
            <QueryErrorState
              error={error}
              onRetry={() => {
                void refetch();
              }}
              fallback="Les agrégats bancaires n’ont pas pu être calculés. Réessayez."
            />
          );
        return (() => {
          if (shouldShowSkeleton({ isPending, hasData }) || data === undefined)
            return <BankDashboardSkeleton />;
          return (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Kpi
                  index={0}
                  label="Dossiers"
                  value={formatNumber(data.totals.total)}
                  hint={`${formatNumber(data.totals.aTraiter)} à traiter · ${formatNumber(data.totals.enTraitement)} en cours`}
                  icon={FolderOpenIcon}
                />
                <Kpi
                  index={1}
                  label="Encaissés"
                  value={formatNumber(data.totals.encaisses)}
                  hint={<MoneyText value={data.totals.totalAmountCashed} placeholder="0 FCFA" />}
                  icon={BanknoteIcon}
                />
                <Kpi
                  index={2}
                  label="Taux de rejet"
                  value={`${formatDecimal(data.totals.rejectionRate)} %`}
                  hint={`${formatNumber(data.totals.rejetes)} dossiers rejetés`}
                  icon={PercentIcon}
                />
                <Kpi
                  index={3}
                  label="Délai moyen"
                  value={
                    data.totals.meanDelayHours === null
                      ? '–'
                      : `${formatDecimal(data.totals.meanDelayHours / 24)} j`
                  }
                  hint={
                    data.totals.meanDelayHours === null
                      ? 'Aucun dossier encore clos'
                      : `${formatNumber(Math.round(data.totals.meanDelayHours))} heures entre ouverture et issue`
                  }
                  icon={ClockIcon}
                />
              </div>

              <BankPilotage pilotage={data.pilotage} />

              <div className="grid gap-4 xl:grid-cols-2">
                <ChartCard title="Dossiers par étape">
                  <BankRankChart
                    label="Dossiers"
                    items={data.byStage.map((stage): ClickableSlice => ({
                      label: stage.label,
                      value: stage.cases,
                      onSelect: drillTo({ stageId: stage.stageId, stageType: null }),
                    }))}
                  />
                </ChartCard>

                <ChartCard
                  title="Encaissements dans le temps"
                  description="Nombre (barres) et montant (courbe)"
                >
                  <CashingsOverTimeChart buckets={data.cashingsOverTime} />
                </ChartCard>

                <ChartCard title="Par banque" description="Banque de traitement">
                  <BankShareChart
                    items={data.byBank.map((bank): ClickableSlice => ({
                      label: bank.label,
                      value: bank.cases,
                      onSelect: drillTo({ banqueId: bank.banqueId }),
                    }))}
                  />
                </ChartCard>

                <ChartCard title="Motifs de rejet" description="Dossiers rejetés uniquement">
                  {data.byRejectionReason.length === 0 ? (
                    <EmptyChart message="Aucun dossier rejeté sur la période filtrée." />
                  ) : (
                    <BankRankChart
                      label="Rejets"
                      items={data.byRejectionReason.map((reason): ClickableSlice => ({
                        label: reason.label,
                        value: reason.cases,
                        onSelect: drillTo({
                          rejectionReasonId: reason.reasonId,
                          stageType: 'REJECTED',
                          stageId: null,
                        }),
                      }))}
                    />
                  )}
                </ChartCard>

                <ChartCard title="Activité par agent" description="Dossiers menés à l’encaissement">
                  {data.byAgent.length === 0 ? (
                    <EmptyChart message="Aucune activité d’agent sur la période filtrée." />
                  ) : (
                    <BankRankChart
                      label="Encaissés"
                      items={data.byAgent.map((agent): ClickableSlice => ({
                        label: agent.label,
                        value: agent.cashed,
                        onSelect: drillTo({ agentId: agent.agentId }),
                      }))}
                    />
                  )}
                </ChartCard>

                <ChartCard
                  title="Délai moyen par banque"
                  description="Heures entre ouverture et issue"
                >
                  {data.byBank.every((bank) => bank.meanProcessingHours === null) ? (
                    <EmptyChart message="Aucun dossier clos." />
                  ) : (
                    <MeanDelayChart
                      items={data.byBank
                        .filter((bank) => bank.meanProcessingHours !== null)
                        .map((bank) => ({
                          label: bank.label,
                          hours: bank.meanProcessingHours ?? 0,
                        }))}
                    />
                  )}
                </ChartCard>
              </div>

              {/* Montants par banque : un tableau et non un graphique. Comparer des
              sommes en francs CFA se fait sur des chiffres alignés : un axe de
              barres à sept chiffres est illisible, et le montant exact est
              justement ce qu'on vient chercher. */}
              <Card>
                <CardContent className="overflow-x-auto scrollbar-thin p-0">
                  <table className="w-full text-[0.875rem]">
                    <caption className="px-5 py-3 text-left font-display text-[1.0625rem] font-[700] tracking-[-0.02em]">
                      Montants encaissés par banque
                    </caption>
                    <thead className="border-b border-border">
                      <tr>
                        <th scope="col" className="px-5 py-2 text-left font-[600]">
                          Banque
                        </th>
                        <th scope="col" className="px-5 py-2 text-right font-[600]">
                          Dossiers
                        </th>
                        <th scope="col" className="px-5 py-2 text-right font-[600]">
                          Encaissés
                        </th>
                        <th scope="col" className="px-5 py-2 text-right font-[600]">
                          Rejetés
                        </th>
                        <th scope="col" className="px-5 py-2 text-right font-[600]">
                          Montant
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {data.byBank.map((bank) => (
                        <tr key={bank.banqueId}>
                          <th scope="row" className="px-5 py-2 text-left font-[400]">
                            {bank.label}
                          </th>
                          <td className="px-5 py-2 text-right tabular-nums">
                            {formatNumber(bank.cases)}
                          </td>
                          <td className="px-5 py-2 text-right tabular-nums">
                            {formatNumber(bank.cashed)}
                          </td>
                          <td className="px-5 py-2 text-right tabular-nums">
                            {formatNumber(bank.rejected)}
                          </td>
                          <td className="px-5 py-2 text-right font-[600] tabular-nums">
                            {formatXof(bank.amountXof, '0 FCFA')}
                          </td>
                        </tr>
                      ))}
                      {data.byBank.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="px-5 py-6 text-center text-muted-foreground">
                            Aucun dossier sur la période filtrée.
                          </td>
                        </tr>
                      ) : null}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            </>
          );
        })();
      })()}
    </div>
  );
}

export function BankDashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Card key={index}>
            <CardContent className="flex items-start justify-between gap-3">
              <div className="w-full">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-3 h-7 w-24" />
                <Skeleton className="mt-3 h-3 w-32" />
              </div>
              <Skeleton className="size-10 rounded-md" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <Card key={index}>
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
