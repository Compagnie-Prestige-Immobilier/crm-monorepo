'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { BanknoteIcon, ClockIcon, FolderOpenIcon, PercentIcon } from 'lucide-react';

import {
  BankRankChart,
  BankShareChart,
  CashingsOverTimeChart,
  MeanDelayChart,
  type ClickableSlice,
} from '@/components/bank/bank-charts';
import { useBankFilters } from '@/components/bank/use-bank-filters';
import { LiveIndicator } from '@/components/live/live-indicator';
import { useLive } from '@/components/live/use-live';
import { QueryErrorState } from '@/components/query-error-state';
import {
  StatChartCard,
  StatChartsSkeleton,
  StatTile,
  StatTilesSkeleton,
} from '@/components/stats/stat-tile';
import { Card, CardContent } from '@/components/ui/card';
import { fetchBankAnalytics } from '@/lib/data/bank-cases';
import { formatDecimal, formatNumber } from '@/lib/format';
import { shouldShowError, shouldShowSkeleton } from '@/lib/live';
import { ExactAmountsToggle, MoneyText } from '@/components/money/exact-amounts';
import { formatXof } from '@/lib/money';
import { queryKeys } from '@/lib/query-keys';
import { hoursToDays } from '@/lib/data/statistics';

/**
 * Volet banques.
 *
 * Les cinq exigences du cahier des charges sont servies par un SEUL appel,
 * `GET /bank-cases/analytics`, qui calcule tout en SQL : délai de traitement
 * (`meanDelayHours`), taux d'erreurs (`rejectionRate`), volumes (`total`,
 * `createdOverTime`), répartition par établissement (`byBank`) et évolution
 * dans le temps (`createdOverTime`, `cashingsOverTime`).
 *
 * Rien n'est recalculé ici à partir d'une liste de dossiers : un tableau de
 * bord qui rapatrierait dix mille dossiers pour en compter les encaissements
 * transporterait des données nominatives sans raison et s'effondrerait à la
 * première vraie volumétrie.
 */
export function BanksPanel() {
  const { filters } = useBankFilters();
  const live = useLive();

  const { data, isPending, isError, error, refetch, dataUpdatedAt } = useQuery({
    queryKey: queryKeys.bankAnalytics(filters),
    queryFn: () => fetchBankAnalytics(filters),
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
        fallback="Les statistiques bancaires n’ont pas pu être calculées. Réessayez."
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

  const delayDays = hoursToDays(data.totals.meanDelayHours);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-end gap-3">
        <ExactAmountsToggle />
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
          stat="bankVolume"
          label="Dossiers"
          value={data.totals.total}
          hint={`${formatNumber(data.totals.aTraiter)} à traiter, ${formatNumber(data.totals.enTraitement)} en cours`}
          icon={FolderOpenIcon}
        />
        <StatTile
          index={1}
          stat="bankCashed"
          label="Encaissés"
          value={data.totals.encaisses}
          hint={<MoneyText value={data.totals.totalAmountCashed} placeholder="0 FCFA" />}
          icon={BanknoteIcon}
          tone="success"
        />
        <StatTile
          index={2}
          stat="bankRejectionRate"
          label="Taux d’erreurs"
          value={`${formatDecimal(data.totals.rejectionRate)} %`}
          hint={`${formatNumber(data.totals.rejetes)} rejetés`}
          icon={PercentIcon}
          tone={data.totals.rejectionRate > 0 ? 'destructive' : 'default'}
        />
        <StatTile
          index={3}
          stat="bankMeanDelay"
          label="Délai de traitement"
          value={delayDays === null ? 'Sans objet' : `${formatDecimal(delayDays)} j`}
          hint={
            data.totals.meanDelayHours === null
              ? 'Aucun dossier clos'
              : `${formatNumber(Math.round(data.totals.meanDelayHours))} heures`
          }
          icon={ClockIcon}
          tone="warning"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <StatChartCard stat="bankOverTime" title="Dossiers dans le temps" className="xl:col-span-2">
          <CashingsOverTimeChart buckets={data.createdOverTime} />
        </StatChartCard>

        <StatChartCard stat="bankCashingsOverTime" title="Encaissements dans le temps">
          <CashingsOverTimeChart buckets={data.cashingsOverTime} />
        </StatChartCard>

        <StatChartCard stat="bankByEstablishment" title="Répartition par établissement">
          <BankShareChart
            items={data.byBank.map((bank): ClickableSlice => ({
              label: bank.label,
              value: bank.cases,
            }))}
          />
        </StatChartCard>

        <StatChartCard stat="bankByStage" title="Dossiers par étape">
          <BankRankChart
            label="Dossiers"
            items={data.byStage.map((stage): ClickableSlice => ({
              label: stage.label,
              value: stage.cases,
            }))}
          />
        </StatChartCard>

        <StatChartCard stat="bankByRejectionReason" title="Motifs de rejet">
          {data.byRejectionReason.length === 0 ? (
            <EmptyChart message="Aucun dossier rejeté sur la sélection." />
          ) : (
            <BankRankChart
              label="Rejets"
              items={data.byRejectionReason.map((reason): ClickableSlice => ({
                label: reason.label,
                value: reason.cases,
              }))}
            />
          )}
        </StatChartCard>

        <StatChartCard
          stat="bankDelayByEstablishment"
          title="Délai par établissement"
          className="xl:col-span-2"
        >
          {data.byBank.every((bank) => bank.meanProcessingHours === null) ? (
            <EmptyChart message="Aucun dossier clos sur la sélection." />
          ) : (
            <MeanDelayChart
              items={data.byBank
                .filter((bank) => bank.meanProcessingHours !== null)
                .map((bank) => ({ label: bank.label, hours: bank.meanProcessingHours ?? 0 }))}
            />
          )}
        </StatChartCard>
      </div>

      {/* Les montants sont un TABLEAU et non un graphique : comparer des
          sommes en francs CFA se fait sur des chiffres alignés, et un axe de
          barres à sept chiffres est illisible. */}
      <Card className="animate-rise">
        <CardContent className="overflow-x-auto scrollbar-thin p-0">
          <table className="w-full text-[0.875rem]">
            <caption className="px-5 py-3 text-left font-display text-[1.0625rem] font-[700] tracking-[-0.02em]">
              Montants par établissement
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
                  Délai
                </th>
                <th scope="col" className="px-5 py-2 text-right font-[600]">
                  Montant
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.byBank.map((bank) => {
                const days = hoursToDays(bank.meanProcessingHours);
                return (
                  <tr key={bank.bankId}>
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
                    <td className="px-5 py-2 text-right tabular-nums">
                      {days === null ? 'Sans objet' : `${formatDecimal(days)} j`}
                    </td>
                    <td className="px-5 py-2 text-right font-[600] tabular-nums">
                      {formatXof(bank.amountXof, '0 FCFA')}
                    </td>
                  </tr>
                );
              })}
              {data.byBank.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-muted-foreground">
                    Aucun dossier sur la sélection.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center px-4 text-center">
      <p className="text-[0.8125rem] text-muted-foreground">{message}</p>
    </div>
  );
}
