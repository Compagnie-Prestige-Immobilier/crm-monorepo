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

/**
 * Volet « Campagnes ».
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Le manque le plus criant du produit, avant ce volet : rien.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * L'avancement d'une campagne était calculé en ligne dans
 * `campaigns.service.ts` et ne remontait jamais dans `/analytics/*`. On pouvait
 * voir qu'une campagne existait, pas si elle avançait, ni quand elle
 * finirait, ni combien d'appels coûtait une méthode obtenue.
 *
 * Le volet prend le MÊME objet de filtre que les prospects : le filtre
 * « Campagne » de la barre en haut d'écran restreint donc ces chiffres à une
 * campagne précise, et son absence les calcule sur toutes les campagnes
 * actives. C'est ce qui permet de comparer une campagne au reste sans changer
 * d'écran.
 */
export function CampaignsPanel() {
  const { filters } = useProspectFilters();
  /**
   * Le volet se rafraîchit comme ses deux voisins, et le DIT.
   *
   * Les volets « Téléconseil » et « Banques » portaient un `LiveIndicator`,
   * celui-ci non. Trois onglets côte à côte, deux vivants et un muet : rien à
   * l'écran ne permettait de savoir si « Reste à faire » datait de la seconde
   * ou de la demi-heure précédente. Sur un chiffre d'avancement de campagne,
   * c'est exactement la question qu'on se pose.
   */
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
          /* `null` signifie « aucune tâche », pas « 0 % de tâches touchées » :
             les afficher pareil ferait passer une campagne vide pour une
             campagne en échec. */
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
          // Sous la moitié des appels aboutis, ce n'est plus le téléconseil qui
          // est en cause mais la base : le ton doit le signaler. Un taux absent
          // n'alerte pas : il n'y a rien à alerter.
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
          /**
           * L'échec de CETTE requête doit voyager jusqu'à la carte.
           *
           * Seul `pilotage.isError` était traité, plus haut. La requête de
           * qualité n'avait aucune branche d'erreur : `data` restait
           * `undefined`, les valeurs par défaut ci-dessus prenaient le relais,
           * et la carte affirmait « Aucun appel enregistré sur la sélection »,
           * c'est-à-dire un FAIT sur l'activité, alors que rien n'avait été
           * mesuré. Un responsable y lit que ses équipes n'ont pas appelé.
           */
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

/**
 * Qualité de la base, par représentant apporteur.
 *
 * En TABLEAU et non en graphique : la question n'est pas « quelle est la
 * forme de la distribution » mais « qui, nommément, apporte des numéros
 * inexploitables ». Un nom et un taux se lisent, une barre sans étiquette non.
 */
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
          {showError
            ? 'Qualité indisponible.'
            : isPending
              ? 'Calcul en cours…'
              : badRate === null
                ? 'Aucun appel enregistré sur la sélection.'
                : `${formatRate(badRate)} de numéros inexploitables sur ${formatNumber(attempts)} appels.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {showError ? (
          <div className="px-5 pb-5">
            <QueryErrorInline
              error={error}
              onRetry={onRetry}
              fallback="La qualité des numéros n’a pas pu être calculée."
            />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-5 pb-5 text-[0.875rem] text-muted-foreground">
            {isPending ? '' : 'Aucun appel enregistré sur la sélection.'}
          </p>
        ) : (
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
        )}
      </CardContent>
    </Card>
  );
}
