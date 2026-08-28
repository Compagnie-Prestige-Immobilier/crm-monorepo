'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronsUpDownIcon,
  DownloadIcon,
  PhoneCallIcon,
  PhoneOffIcon,
  TargetIcon,
  UserPlusIcon,
  type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';

import { DatePicker } from '@/components/filters/date-picker';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  PERIOD_LABELS,
  activityCsv,
  activityCsvFileName,
  activityAverages,
  activityLines,
  activityTotals,
  bucketTotals,
  dakarToday,
  fetchSupervisionActivite,
  presetRange,
  sortActivityLines,
  supervisionActivityKey,
  type ActivityLine,
  type ActivityRange,
  type ActivitySortKey,
  type ActivityTotals,
  type PeriodPreset,
  type SortDirection,
  type SupervisionGranularity,
} from '@/lib/data/admin';
import { downloadCsv } from '@/lib/csv';
import { formatDecimal, formatNumber, formatRateOrNone, formatShortDate } from '@/lib/format';
import { shouldShowError, shouldShowSkeleton } from '@/lib/live';
import { cn } from '@/lib/utils';

const COLUMNS: { key: ActivitySortKey; label: string }[] = [
  { key: 'calls', label: 'Appels' },
  { key: 'methodObtained', label: 'Méthodes' },
  { key: 'unreachable', label: 'NRP / injoignables' },
  { key: 'wrongNumber', label: 'Faux numéros' },
  { key: 'refused', label: 'Refus' },
  { key: 'callback', label: 'À rappeler' },
  { key: 'reachRate', label: 'Joignabilité' },
  { key: 'prospectsCreated', label: 'Prospects saisis' },
  { key: 'representantsContacted', label: 'Représentants contactés' },
  { key: 'tasksClosed', label: 'Tâches closes' },
  { key: 'openTasks', label: 'Reste à faire' },
];

const PRESETS: Exclude<PeriodPreset, 'custom'>[] = ['today', 'week', 'last7'];

export function ActivityView() {
  const [preset, setPreset] = useState<PeriodPreset>('today');
  const [range, setRange] = useState<ActivityRange>(() => presetRange('today'));
  const [granularity, setGranularity] = useState<SupervisionGranularity>('day');
  const [sortKey, setSortKey] = useState<ActivitySortKey>('calls');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: supervisionActivityKey(range, granularity),
    queryFn: () => fetchSupervisionActivite({ range, granularity }),
    placeholderData: keepPreviousData,
  });

  function selectPreset(next: Exclude<PeriodPreset, 'custom'>): void {
    setPreset(next);
    setRange(presetRange(next));
  }

  function toggleSort(key: ActivitySortKey): void {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortKey(key);
    setSortDir(key === 'name' ? 'asc' : 'desc');
  }

  const hasData = data !== undefined;

  const toolbar = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((value) => (
          <Button
            key={value}
            variant={preset === value ? 'default' : 'outline'}
            size="sm"
            aria-pressed={preset === value}
            onClick={() => {
              selectPreset(value);
            }}
          >
            {PERIOD_LABELS[value]}
          </Button>
        ))}
        <Button
          variant={preset === 'custom' ? 'default' : 'outline'}
          size="sm"
          aria-pressed={preset === 'custom'}
          onClick={() => {
            setPreset('custom');
          }}
        >
          {PERIOD_LABELS.custom}
        </Button>

        <span className="ml-auto flex items-center gap-2">
          <span className="inline-flex overflow-hidden rounded-md border border-border">
            <Button
              variant={granularity === 'day' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
              aria-pressed={granularity === 'day'}
              onClick={() => {
                setGranularity('day');
              }}
            >
              Par jour
            </Button>
            <Button
              variant={granularity === 'week' ? 'default' : 'ghost'}
              size="sm"
              className="rounded-none"
              aria-pressed={granularity === 'week'}
              onClick={() => {
                setGranularity('week');
              }}
            >
              Par semaine
            </Button>
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasData}
            onClick={() => {
              if (data === undefined) return;
              const lines = sortActivityLines(activityLines(data), sortKey, sortDir);
              downloadCsv(
                activityCsv({ lines, totals: activityTotals(lines), range, granularity }),
                activityCsvFileName(range),
              );
            }}
          >
            <DownloadIcon aria-hidden="true" />
            Exporter en CSV
          </Button>
        </span>
      </div>

      {preset === 'custom' ? (
        <div className="flex flex-wrap items-end gap-3">
          <DatePicker
            id="activite-du"
            label="Du"
            value={range.from}
            max={range.to}
            onChange={(from) => {
              setRange({ from: from ?? dakarToday(), to: range.to });
            }}
          />
          <DatePicker
            id="activite-au"
            label="Au"
            value={range.to}
            min={range.from}
            onChange={(to) => {
              setRange({ from: range.from, to: to ?? dakarToday() });
            }}
          />
        </div>
      ) : null}
    </div>
  );

  if (shouldShowError({ isError, hasData })) {
    return (
      <div className="flex flex-col gap-6">
        {toolbar}
        <QueryErrorState
          error={error}
          onRetry={() => {
            void refetch();
          }}
          fallback="L’activité de la période n’a pas pu être lue. Réessayez."
        />
      </div>
    );
  }

  if (shouldShowSkeleton({ isPending, hasData }) || data === undefined) {
    return (
      <div className="flex flex-col gap-6">
        {toolbar}
        <ActivitySkeleton />
      </div>
    );
  }

  const lines = sortActivityLines(activityLines(data), sortKey, sortDir);
  const totals = activityTotals(lines);
  const averages = activityAverages(totals);
  const buckets = bucketTotals(data.items);

  return (
    <div className="flex flex-col gap-6">
      {toolbar}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile index={0} label="Appels" value={formatNumber(totals.calls)} icon={PhoneCallIcon} />
        <Tile
          index={1}
          label="Joignabilité"
          value={formatRateOrNone(totals.reachRate)}
          icon={PhoneOffIcon}
        />
        <Tile
          index={2}
          label="Méthodes obtenues"
          value={formatNumber(totals.methodObtained)}
          icon={TargetIcon}
        />
        <Tile
          index={3}
          label="Prospects saisis"
          value={formatNumber(totals.prospectsCreated)}
          icon={UserPlusIcon}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead aria-sort={ariaSort(sortKey === 'name', sortDir)}>
                  <SortButton
                    label="Téléconseiller"
                    active={sortKey === 'name'}
                    direction={sortDir}
                    onClick={() => {
                      toggleSort('name');
                    }}
                  />
                </TableHead>
                {COLUMNS.map((column) => (
                  <TableHead
                    key={column.key}
                    className="text-right"
                    aria-sort={ariaSort(sortKey === column.key, sortDir)}
                  >
                    <SortButton
                      label={column.label}
                      active={sortKey === column.key}
                      direction={sortDir}
                      onClick={() => {
                        toggleSort(column.key);
                      }}
                    />
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <ActivityRow key={line.id} line={line} />
              ))}
              {lines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length + 1} className="py-8 text-center">
                    Aucun compte téléconseiller. Créez-en un depuis les comptes.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
            {lines.length > 0 ? (
              <TableFooter>
                <TotalsRow label="Total équipe" values={totals} />
                <TotalsRow label="Moyenne par téléconseiller" values={averages} decimal />
              </TableFooter>
            ) : null}
          </Table>
        </CardContent>
      </Card>

      <p className="text-[0.8125rem] text-muted-foreground">
        « Reste à faire » compte les tâches d’appel encore ouvertes à l’instant : la période ne le
        borne pas. Les autres colonnes portent sur la date de l’acte.
      </p>

      {buckets.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <caption className="px-3 py-3 text-left font-display text-[1.0625rem] font-[700] tracking-[-0.02em]">
                {granularity === 'week' ? 'Équipe, par semaine' : 'Équipe, par jour'}
              </caption>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{granularity === 'week' ? 'Semaine' : 'Jour'}</TableHead>
                  <TableHead className="text-right">Appels</TableHead>
                  <TableHead className="text-right">Méthodes</TableHead>
                  <TableHead className="text-right">NRP / injoignables</TableHead>
                  <TableHead className="text-right">Faux numéros</TableHead>
                  <TableHead className="text-right">Refus</TableHead>
                  <TableHead className="text-right">À rappeler</TableHead>
                  <TableHead className="text-right">Joignabilité</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {buckets.map((bucket) => (
                  <TableRow key={bucket.bucket}>
                    <TableCell className="font-[600]">
                      {granularity === 'week'
                        ? `Semaine du ${formatShortDate(bucket.bucket)}`
                        : formatShortDate(bucket.bucket)}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(bucket.calls)}</TableCell>
                    <TableCell className="text-right">
                      {formatNumber(bucket.methodObtained)}
                    </TableCell>
                    <TableCell className="text-right">{formatNumber(bucket.unreachable)}</TableCell>
                    <TableCell className="text-right">{formatNumber(bucket.wrongNumber)}</TableCell>
                    <TableCell className="text-right">{formatNumber(bucket.refused)}</TableCell>
                    <TableCell className="text-right">{formatNumber(bucket.callback)}</TableCell>
                    <TableCell className="text-right">
                      {formatRateOrNone(bucket.reachRate)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ActivityRow({ line }: { line: ActivityLine }) {
  const muted = !line.hasActivity;
  return (
    <TableRow className={cn(muted && 'bg-secondary/40 text-muted-foreground')}>
      <th scope="row" className="px-3 py-2.5 text-left font-[400]">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-[600]">{line.name}</span>
          {!line.isActive ? <Badge variant="outline">Désactivé</Badge> : null}
          {muted ? <Badge variant="outline">Aucun acte</Badge> : null}
        </span>
      </th>
      <TableCell className="text-right">{formatNumber(line.calls)}</TableCell>
      <TableCell className="text-right">{formatNumber(line.methodObtained)}</TableCell>
      <TableCell className="text-right">{formatNumber(line.unreachable)}</TableCell>
      <TableCell className="text-right">{formatNumber(line.wrongNumber)}</TableCell>
      <TableCell className="text-right">{formatNumber(line.refused)}</TableCell>
      <TableCell className="text-right">{formatNumber(line.callback)}</TableCell>
      <TableCell className={cn('text-right', line.reachRate === null && 'text-muted-foreground')}>
        {formatRateOrNone(line.reachRate)}
      </TableCell>
      <TableCell className="text-right">{formatNumber(line.prospectsCreated)}</TableCell>
      <TableCell className="text-right">{formatNumber(line.representantsContacted)}</TableCell>
      <TableCell className="text-right">{formatNumber(line.tasksClosed)}</TableCell>
      <TableCell className="text-right">{formatNumber(line.openTasks)}</TableCell>
    </TableRow>
  );
}

function TotalsRow({
  label,
  values,
  decimal = false,
}: {
  label: string;
  values: Omit<ActivityTotals, 'people'>;
  decimal?: boolean;
}) {
  const show = (value: number): string => (decimal ? formatDecimal(value) : formatNumber(value));
  return (
    <TableRow className="hover:bg-transparent">
      <th scope="row" className="px-3 py-2.5 text-left font-[600]">
        {label}
      </th>
      <TableCell className="text-right">{show(values.calls)}</TableCell>
      <TableCell className="text-right">{show(values.methodObtained)}</TableCell>
      <TableCell className="text-right">{show(values.unreachable)}</TableCell>
      <TableCell className="text-right">{show(values.wrongNumber)}</TableCell>
      <TableCell className="text-right">{show(values.refused)}</TableCell>
      <TableCell className="text-right">{show(values.callback)}</TableCell>
      <TableCell className="text-right">{formatRateOrNone(values.reachRate)}</TableCell>
      <TableCell className="text-right">{show(values.prospectsCreated)}</TableCell>
      <TableCell className="text-right">{show(values.representantsContacted)}</TableCell>
      <TableCell className="text-right">{show(values.tasksClosed)}</TableCell>
      <TableCell className="text-right">{show(values.openTasks)}</TableCell>
    </TableRow>
  );
}

function SortButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-sm text-inherit hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {label}
      {(() => {
        if (active)
          return (() => {
            if (direction === 'asc') return <ArrowUpIcon className="size-3.5" aria-hidden="true" />;
            return <ArrowDownIcon className="size-3.5" aria-hidden="true" />;
          })();
        return <ChevronsUpDownIcon className="size-3.5 opacity-40" aria-hidden="true" />;
      })()}
    </button>
  );
}

function Tile({
  label,
  value,
  icon: Icon,
  index,
}: {
  label: string;
  value: string;
  icon: LucideIcon;
  index: number;
}) {
  return (
    <Card className="animate-rise" style={{ animationDelay: `${String(index * 60)}ms` }}>
      <CardContent className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[0.75rem] font-[600] uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 font-display text-[1.75rem] font-[800] leading-none tracking-[-0.02em] tabular-nums">
            {value}
          </p>
        </div>
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-md bg-secondary text-primary"
        >
          <Icon className="size-5" />
        </span>
      </CardContent>
    </Card>
  );
}

function ActivitySkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Card key={index}>
            <CardContent>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-7 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardContent className="flex flex-col gap-3 p-5">
          {[0, 1, 2, 3, 4].map((row) => (
            <Skeleton key={row} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ariaSort(active: boolean, direction: SortDirection): 'ascending' | 'descending' | 'none' {
  if (!active) return 'none';
  return direction === 'asc' ? 'ascending' : 'descending';
}
