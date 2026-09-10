'use client';

import { AlertTriangleIcon, HourglassIcon, InboxIcon, TimerIcon } from 'lucide-react';

import { Kpi } from '@/components/bank/bank-kpi';
import { MoneyText } from '@/components/money/exact-amounts';
import { ChartCard } from '@/components/dashboard/chart-card';
import { EmptyChart } from '@/components/dashboard/empty-chart';
import { formatDecimal, formatNumber } from '@/lib/format';
import type { PilotageBanque } from '@/lib/types';

function jours(heures: number | null): string {
  return heures === null ? '–' : `${formatDecimal(heures / 24)} j`;
}

/** L'entonnoir plateforme, les délais par étape et qui a suivi les dossiers encaissés. */
export function BankPilotage({ pilotage }: { pilotage: PilotageBanque }) {
  const e = pilotage.entonnoir;
  const etapes = [
    { label: 'Inscrits', valeur: e.inscrits },
    { label: 'Dossier soumis', valeur: e.soumis },
    { label: 'Validés', valeur: e.valides },
    { label: 'Dossier bancaire ouvert', valeur: e.ouverts },
    { label: 'Encaissés', valeur: e.encaisses },
  ];
  const plafond = Math.max(e.inscrits, 1);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          index={4}
          label="Délai médian"
          value={jours(pilotage.medianDelayHours)}
          hint="Ouverture vers encaissement, moitié des dossiers en dessous"
          icon={TimerIcon}
        />
        <Kpi
          index={5}
          label="En retard"
          value={formatNumber(pilotage.overdue)}
          hint={`Ouverts depuis plus de ${String(pilotage.overdueDays)} jours`}
          icon={AlertTriangleIcon}
        />
        <Kpi
          index={6}
          label="Complets non ouverts"
          value={formatNumber(pilotage.completsNonOuverts)}
          hint={`${formatNumber(pilotage.completsNonOuverts48h)} attendent depuis plus de 48 h`}
          icon={InboxIcon}
        />
        <Kpi
          index={7}
          label="Transformation"
          value={e.valides === 0 ? '–' : `${formatDecimal((e.encaisses / e.valides) * 100)} %`}
          hint="Validés sur la plateforme puis encaissés"
          icon={HourglassIcon}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartCard title="Du compte plateforme à l’encaissement">
          <ol className="flex flex-col gap-2">
            {etapes.map((etape) => (
              <li
                key={etape.label}
                className="grid grid-cols-[10rem_1fr_3.5rem] items-center gap-3 text-[0.8125rem]"
              >
                <span className="truncate text-muted-foreground">{etape.label}</span>
                <span className="h-2.5 overflow-hidden rounded-full bg-secondary">
                  <span
                    className="block h-full rounded-full bg-primary transition-[width] duration-500"
                    style={{
                      width: `${String(Math.max((etape.valeur / plafond) * 100, etape.valeur > 0 ? 2 : 0))}%`,
                    }}
                  />
                </span>
                <span className="text-right font-[600] tabular-nums">
                  {formatNumber(etape.valeur)}
                </span>
              </li>
            ))}
          </ol>
        </ChartCard>

        <ChartCard title="Temps médian passé par étape">
          {pilotage.byStageDuration.length === 0 ? (
            <EmptyChart message="Aucune transition encore mesurée." />
          ) : (
            <ul className="flex flex-col gap-2 text-[0.8125rem]">
              {pilotage.byStageDuration.map((etape) => (
                <li key={etape.stageId} className="flex items-center justify-between gap-3">
                  <span className="truncate">{etape.label}</span>
                  <span className="font-[600] tabular-nums">{jours(etape.medianHours)}</span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>

        <ChartCard title="Encaissements par téléconseiller">
          {pilotage.byTeleconseiller.length === 0 ? (
            <EmptyChart message="Aucun dossier suivi sur la période." />
          ) : (
            <ul className="flex flex-col gap-2 text-[0.8125rem]">
              {pilotage.byTeleconseiller.map((agent) => (
                <li key={agent.agentId} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">
                    {agent.label}
                    <span className="text-muted-foreground">
                      {' '}
                      · {formatNumber(agent.cases)} dossiers
                    </span>
                  </span>
                  <span className="shrink-0 font-[600] tabular-nums">
                    {formatNumber(agent.cashed)} encaissés,{' '}
                    <MoneyText value={agent.amountXof} placeholder="0 FCFA" />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>
    </>
  );
}
