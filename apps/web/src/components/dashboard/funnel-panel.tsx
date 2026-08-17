'use client';

import { BanknoteIcon, CalendarRangeIcon, PercentIcon, ReceiptTextIcon } from 'lucide-react';

import { MoneyText } from '@/components/money/exact-amounts';
import { StatInfo } from '@/components/stats/stat-info';
import { StatTile } from '@/components/stats/stat-tile';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { breakingStageIndex, type Funnel, type FunnelStage } from '@/lib/data/funnel';
import { formatNumber, formatRate, formatRateOrNone } from '@/lib/format';
import { cn } from '@/lib/utils';

function MoneyHeadline({ finance }: { finance: Funnel['finance'] }) {
  return (
    <Card className="animate-rise border-primary/25">
      <CardContent className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[0.75rem] font-[600] uppercase tracking-wide text-muted-foreground">
            Encaissé
            <StatInfo stat="moneyCashed" label="Encaissé" />
          </p>

          {/* Le chiffre de la page : le plus gros de l'écran, et le premier
              lisible. Tout le reste de la chaîne le prépare. */}
          <p className="mt-2 font-display text-display font-[800] leading-none tracking-[-0.02em]">
            <MoneyText
              value={finance.montantEncaisse}
              placeholder="0 FCFA"
              className="text-primary-text"
            />
          </p>
        </div>

        <div className="flex items-center gap-8">
          <dl className="flex flex-wrap gap-x-8 gap-y-2">
            <div className="flex flex-col gap-1">
              <dt className="text-[0.75rem] text-muted-foreground">Dossiers encaissés</dt>
              <dd className="font-display text-[1.25rem] font-[700] leading-none tabular-nums">
                {formatNumber(finance.dossiersEncaisses)} sur {formatNumber(finance.dossiers)}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-[0.75rem] text-muted-foreground">En cours</dt>
              <dd className="font-display text-[1.25rem] font-[700] leading-none">
                <MoneyText value={finance.montantEnCours} placeholder="0 FCFA" />
              </dd>
            </div>
          </dl>

          <span
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-md bg-secondary text-primary"
          >
            <BanknoteIcon className="size-6" />
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function MoneyBand({ finance }: { finance: Funnel['finance'] }) {
  return (
    <div className="flex flex-col gap-4">
      <MoneyHeadline finance={finance} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatTile
          index={1}
          stat="moneyCashed30Days"
          label="Sur 30 jours"
          value={<MoneyText value={finance.montantEncaisse30Jours} placeholder="0 FCFA" />}
          icon={CalendarRangeIcon}
        />
        <StatTile
          index={2}
          stat="moneyAverageCashing"
          label="Encaissement moyen"
          value={<MoneyText value={finance.encaissementMoyen} placeholder="0 FCFA" />}
          hint="Par dossier encaissé"
          icon={ReceiptTextIcon}
        />
        <StatTile
          index={3}
          stat="moneyRejectionRate"
          label="Taux de rejet"
          value={formatRate(finance.tauxRejet)}
          hint={`${formatNumber(finance.dossiersRejetes)} rejetés`}
          icon={PercentIcon}
          tone={finance.tauxRejet > 0 ? 'destructive' : 'default'}
        />
      </div>
    </div>
  );
}

function barWidth(stage: FunnelStage): string {
  if (stage.count === 0) return '0%';
  if (stage.tauxGlobal === null) return '0%';
  return `${String(Math.max(1.5, Math.min(100, stage.tauxGlobal)))}%`;
}

const CELL = 'px-3 py-3 align-middle';

export function FunnelCard({ stages }: { stages: readonly FunnelStage[] }) {
  const breaking = breakingStageIndex(stages);

  return (
    <Card className="animate-rise">
      <div className="flex flex-col gap-1 px-5 pt-1">
        <h2 className="flex items-center gap-2 font-display text-h4 font-[700] tracking-[-0.02em]">
          Entonnoir
          <StatInfo stat="funnelStages" label="Entonnoir" />
        </h2>
        <p className="text-small text-muted-foreground">Du prospect saisi au dossier encaissé</p>
      </div>

      {/* Le tableau déborde plutôt que de comprimer ses colonnes : quatre
          chiffres serrés sur 320 px deviennent illisibles bien avant de tenir. */}
      <div className="overflow-x-auto px-2 pb-1">
        <table className="w-full min-w-[34rem] border-collapse text-left">
          <caption className="sr-only">
            Effectif et taux de passage de chaque étape, du prospect saisi au dossier encaissé.
          </caption>
          <thead>
            <tr className="text-[0.6875rem] font-[600] uppercase tracking-wide text-muted-foreground">
              <th scope="col" className={cn(CELL, 'font-[600]')}>
                Étape
              </th>
              <th scope="col" className={cn(CELL, 'w-24 text-right font-[600]')}>
                Effectif
              </th>
              {/* La colonne qui montre OÙ la chaîne casse. Elle est nommée en
                  entier : « précédente » seul se confondrait avec le total. */}
              <th scope="col" className={cn(CELL, 'w-40 text-right font-[600] text-foreground')}>
                De l’étape précédente
              </th>
              <th scope="col" className={cn(CELL, 'w-24 text-right font-[600]')}>
                Du total
              </th>
            </tr>
          </thead>
          <tbody>
            {stages.map((stage, index) => {
              const isBreaking = index === breaking;
              return (
                <tr
                  key={stage.label}
                  className={cn(
                    'border-t border-border',
                    isBreaking && 'bg-destructive-surface/50',
                  )}
                >
                  <th scope="row" className={cn(CELL, 'font-[400]')}>
                    <span className="block text-[0.875rem] font-[600]">{stage.label}</span>
                    <span
                      aria-hidden="true"
                      className="mt-1.5 block h-2 w-full overflow-hidden rounded-full bg-muted"
                    >
                      <span
                        className={cn(
                          'block h-full rounded-full transition-[width] duration-(--dur-3) ease-(--ease-out-cpi)',
                          isBreaking ? 'bg-destructive' : 'bg-primary',
                        )}
                        style={{ width: barWidth(stage) }}
                      />
                    </span>
                  </th>

                  <td className={cn(CELL, 'text-right text-[0.9375rem] font-[600] tabular-nums')}>
                    {formatNumber(stage.count)}
                  </td>

                  <td className={cn(CELL, 'text-right')}>
                    {index === 0 ? (
                      <span className="text-[0.8125rem] text-muted-foreground">Origine</span>
                    ) : (
                      <span className="flex items-center justify-end gap-2">
                        {isBreaking ? (
                          <span className="rounded-full bg-destructive px-2 py-0.5 text-[0.6875rem] font-[600] text-destructive-foreground">
                            Rupture
                          </span>
                        ) : null}
                        <span
                          className={cn(
                            'font-display text-[1.125rem] font-[800] tabular-nums',
                            isBreaking && 'text-destructive',
                          )}
                        >
                          {formatRateOrNone(stage.tauxEtapePrecedente)}
                        </span>
                      </span>
                    )}
                  </td>

                  <td
                    className={cn(
                      CELL,
                      'text-right text-[0.8125rem] tabular-nums text-muted-foreground',
                    )}
                  >
                    {formatRateOrNone(stage.tauxGlobal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function FunnelPanel({ funnel }: { funnel: Funnel }) {
  return (
    <div className="flex flex-col gap-4">
      <MoneyBand finance={funnel.finance} />
      <FunnelCard stages={funnel.etapes} />
    </div>
  );
}

export function FunnelPanelSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <Card>
          <CardContent className="flex items-start justify-between gap-4">
            <div className="w-full">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-10 w-56" />
              <Skeleton className="mt-4 h-3 w-48" />
            </div>
            <Skeleton className="size-11 rounded-md" />
          </CardContent>
        </Card>
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <Card key={index}>
              <CardContent className="flex items-start justify-between gap-3">
                <div className="w-full">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-3 h-7 w-24" />
                </div>
                <Skeleton className="size-10 rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      <Card>
        <div className="px-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="mt-2 h-3 w-56" />
        </div>
        <div className="flex flex-col gap-3 px-5 pb-1">
          {[0, 1, 2, 3].map((index) => (
            <Skeleton key={index} className="h-10 w-full rounded-md" />
          ))}
        </div>
      </Card>
    </div>
  );
}
