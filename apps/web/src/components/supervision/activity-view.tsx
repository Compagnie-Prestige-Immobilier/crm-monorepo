'use client';

import {
  keepPreviousData,
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronsUpDownIcon,
  DownloadIcon,
  Clock3Icon,
  GaugeIcon,
  PhoneCallIcon,
  PhoneOffIcon,
  TargetIcon,
  UserPlusIcon,
  type LucideIcon,
} from 'lucide-react';
import { Fragment, useState } from 'react';

import { DatePicker } from '@/components/filters/date-picker';
import { AnimatedNumber } from '@/components/live/animated-number';
import { QueryErrorState } from '@/components/query-error-state';
import {
  Fact,
  ScoreBadge,
  ScoreFacts,
  ScoreParts,
  ScoreToggle,
  byScoreDesc,
  callsPerActiveHour,
} from '@/components/supervision/score';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  ACTIVITY_COLUMNS,
  FAMILLE_LABELS,
  PERIOD_LABELS,
  activityCsv,
  activityCsvFileName,
  activityAverages,
  activityLines,
  activityTotals,
  bucketTotals,
  dakarToday,
  famillesDuProjet,
  fetchSupervisionActivite,
  fetchWorkShifts,
  formatActiveDuration,
  formatDuration,
  presetRange,
  sortActivityLines,
  supervisionActivityKey,
  updateWorkShifts,
  type ActivityColumn,
  type ActivityCounts,
  type ActivityFamille,
  type ActivityKey,
  type ActivityLine,
  type ActivityRange,
  type ActivitySortKey,
  type PeriodPreset,
  type SortDirection,
  type SupervisionActivity,
  type SupervisionGranularity,
  type SupervisionScore,
  type UpdateWorkShifts,
  type WorkShifts,
} from '@/lib/data/admin';
import { fetchComptageOuvertures } from '@/lib/data/ouvertures';
import { downloadCsv } from '@/lib/csv';
import { formatDecimal, formatNumber, formatRateOrNone, formatShortDate } from '@/lib/format';
import { shouldShowError, shouldShowSkeleton } from '@/lib/live';
import type { Projet } from '@/lib/types';
import { cn } from '@/lib/utils';

const TUILES: Record<ActivityFamille, { key: ActivityKey; icon: LucideIcon }[]> = {
  representants: [
    { key: 'repCalls', icon: PhoneCallIcon },
    { key: 'repContactRate', icon: PhoneOffIcon },
    { key: 'repCallback', icon: TargetIcon },
    { key: 'prospectsCreated', icon: UserPlusIcon },
  ],
  prospects: [
    { key: 'calls', icon: PhoneCallIcon },
    { key: 'reachRate', icon: PhoneOffIcon },
    { key: 'methodObtained', icon: TargetIcon },
    { key: 'prospectsCreated', icon: UserPlusIcon },
  ],
};

const PRESETS: Exclude<PeriodPreset, 'custom'>[] = ['today', 'week', 'last7'];

export function ActivityView({ projet }: { projet: Projet }) {
  const familles = famillesDuProjet(projet);
  const [famille, setFamille] = useState<ActivityFamille>(familles[0] ?? 'prospects');
  const colonnes = ACTIVITY_COLUMNS[famille];
  const [preset, setPreset] = useState<PeriodPreset>('today');
  const [range, setRange] = useState<ActivityRange>(() => presetRange('today'));
  const [granularity, setGranularity] = useState<SupervisionGranularity>('day');
  const [sortKey, setSortKey] = useState<ActivitySortKey>(colonnes[0]?.key ?? 'name');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');

  function selectFamille(next: ActivityFamille): void {
    setFamille(next);
    setSortKey(ACTIVITY_COLUMNS[next][0]?.key ?? 'name');
    setSortDir('desc');
  }

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: supervisionActivityKey(range, granularity, projet),
    queryFn: () => fetchSupervisionActivite({ range, granularity, projet }),
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
          {familles.length > 1 ? (
            <span className="inline-flex overflow-hidden rounded-md border border-border">
              {familles.map((value) => (
                <Button
                  key={value}
                  variant={famille === value ? 'default' : 'ghost'}
                  size="sm"
                  className="rounded-none"
                  aria-pressed={famille === value}
                  onClick={() => {
                    selectFamille(value);
                  }}
                >
                  {FAMILLE_LABELS[value]}
                </Button>
              ))}
            </span>
          ) : null}
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
                activityCsv({
                  lines,
                  totals: activityTotals(lines),
                  range,
                  granularity,
                  projet,
                  famille,
                }),
                activityCsvFileName(range, projet, famille),
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
      <p className="text-[0.9375rem] text-muted-foreground">
        Ce volet mesure les appels et les saisies. La connexion à l’application est suivie dans
        Comptes. « Confirmés » compte les appels retrouvés dans le journal du téléphone Android.
      </p>
      {toolbar}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {TUILES[famille].map((tuile, index) => {
          const colonne = colonnes.find((candidate) => candidate.key === tuile.key);
          if (colonne === undefined) return null;
          return (
            <Tile
              key={tuile.key}
              index={index}
              label={colonne.label}
              value={totals[tuile.key]}
              format={(valeur) => valeurAffichee(colonne, valeur)}
              icon={tuile.icon}
            />
          );
        })}
      </div>

      <ShiftComparison range={range} granularity={granularity} projet={projet} famille={famille} />

      <FichesOuvertes range={range} />

      <ScoreSection scores={data.scores} />

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
                {colonnes.map((column) => (
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
                <ActivityRow key={line.id} line={line} colonnes={colonnes} />
              ))}
              {lines.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={colonnes.length + 1} className="py-8 text-center">
                    Aucun compte téléconseiller. Créez-en un depuis les comptes.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
            {lines.length > 0 ? (
              <TableFooter>
                <TotalsRow label="Total équipe" values={totals} colonnes={colonnes} />
                <TotalsRow
                  label="Moyenne par téléconseiller"
                  values={averages}
                  colonnes={colonnes}
                  decimal
                />
              </TableFooter>
            ) : null}
          </Table>
        </CardContent>
      </Card>

      <p className="text-[0.8125rem] text-muted-foreground">
        Chaque colonne porte sur la date de l’acte, dans la période choisie.
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
                  {colonnes.map((colonne) => (
                    <TableHead key={colonne.key} className="text-right">
                      {colonne.label}
                    </TableHead>
                  ))}
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
                    {colonnes.map((colonne) => (
                      <Cellule key={colonne.key} colonne={colonne} valeur={bucket[colonne.key]} />
                    ))}
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

/**
 * Section à part, et non une colonne du tableau d'activité : une ouverture ne
 * suit pas la famille d'appel, et son compte se lit par jour, pas par période.
 */
function FichesOuvertes({ range }: { range: ActivityRange }) {
  const comptage = useQuery({
    queryKey: ['ouvertures', 'comptage', range.from, range.to] as const,
    queryFn: () => fetchComptageOuvertures({ from: range.from, to: range.to }),
  });

  if (comptage.isPending) return <Skeleton className="h-40 w-full" />;
  if (comptage.isError) return null;

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <caption className="px-3 py-3 text-left font-display text-[1.0625rem] font-[700] tracking-[-0.02em]">
            Fiches ouvertes, par téléconseiller et par jour
          </caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Téléconseiller</TableHead>
              <TableHead>Jour</TableHead>
              <TableHead className="text-right">Fiches ouvertes</TableHead>
              <TableHead className="text-right">Durée moyenne</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {comptage.data.map((ligne) => (
              <TableRow key={`${ligne.openedById}-${ligne.jour}`}>
                <TableCell className="font-[600]">{ligne.openedByName}</TableCell>
                <TableCell>{formatShortDate(ligne.jour)}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(ligne.ouvertures)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatDuration(ligne.dureeMoyenneSecondes)}
                </TableCell>
              </TableRow>
            ))}
            {comptage.data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-8 text-center">
                  Aucune fiche ouverte sur la période. Élargissez les dates.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/** Section à part, et non une colonne du tableau d'activité : la note ne suit ni
    le tri par colonne, ni le filtre par famille, ni le découpage par jour. */
function ScoreSection({ scores }: { scores: SupervisionScore[] }) {
  const shiftsQuery = useQuery({
    queryKey: ['supervision', 'creneaux'],
    queryFn: () => fetchWorkShifts(),
  });
  const [openId, setOpenId] = useState<string | null>(null);

  const creneaux = (shiftsQuery.data?.shifts ?? []).map(
    (shift) => `${shift.label} ${shift.start}-${shift.end}`,
  );

  return (
    <Card>
      <CardContent className="p-0">
        <div className="px-5 py-4">
          <h2
            id="rendement-periode"
            className="flex items-center gap-2 font-display text-[1.0625rem] font-[700]"
          >
            <GaugeIcon className="size-4" aria-hidden="true" />
            Rendement sur la période
          </h2>
          <p className="mt-1 text-[0.8125rem] text-muted-foreground">
            {creneaux.length > 0
              ? `Note calculée sur ${creneaux.join(' et ')} ; rétrécir ces créneaux rétrécit d’autant la mesure. `
              : ''}
            Seuls les jours où le compte a été vu sont comptés : un dimanche ou un congé ne fait pas
            baisser la note.
          </p>
        </div>

        <Table aria-labelledby="rendement-periode">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Téléconseiller</TableHead>
              <TableHead>Rendement</TableHead>
              <TableHead className="text-right">Appels</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {byScoreDesc(scores).map((row) => {
              const open = openId === row.teleconseillerId;
              return (
                <Fragment key={row.teleconseillerId}>
                  <TableRow>
                    <th scope="row" className="px-3 py-2.5 text-left font-[400]">
                      <ScoreToggle
                        open={open}
                        onToggle={() => {
                          setOpenId(open ? null : row.teleconseillerId);
                        }}
                      >
                        <span className="font-[600]">{row.teleconseillerName}</span>
                      </ScoreToggle>
                    </th>
                    <TableCell>
                      <ScoreBadge score={row.score} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(row.calls)}
                    </TableCell>
                  </TableRow>
                  {open ? (
                    <TableRow className="bg-secondary/40 hover:bg-secondary/40">
                      <TableCell colSpan={3} className="px-5 pb-4 pt-2">
                        <div className="grid gap-x-10 gap-y-4 md:grid-cols-2">
                          <ScoreFacts title="Période">
                            <Fact
                              label="Présence en créneau"
                              value={formatActiveDuration(row.activeSecondsInShifts)}
                            />
                            <Fact
                              label="Créneaux écoulés"
                              value={formatActiveDuration(row.shiftSecondsElapsed)}
                            />
                            <Fact
                              label="Appels par heure active"
                              value={callsPerActiveHour(row.calls, row.activeSecondsInShifts)}
                            />
                            <Fact label="Joints" value={formatNumber(row.reached)} />
                            <Fact label="Qualifiés" value={formatNumber(row.qualified)} />
                            <Fact label="Reprises" value={formatNumber(row.repeatCalls)} />
                            <Fact label="Temps mort" value={formatDuration(row.deadSeconds)} />
                          </ScoreFacts>

                          <ScoreParts parts={row.score.parts} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })}
            {scores.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center">
                  Aucune note sur cette période. Élargissez la période.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ShiftComparison({
  range,
  granularity,
  projet,
  famille,
}: {
  range: ActivityRange;
  granularity: SupervisionGranularity;
  projet: Projet;
  famille: ActivityFamille;
}) {
  const queryClient = useQueryClient();
  const shiftsQuery = useQuery({
    queryKey: ['supervision', 'creneaux'],
    queryFn: () => fetchWorkShifts(),
  });
  const shifts = shiftsQuery.data?.shifts ?? [];
  const results = useQueries({
    queries: shifts.map((shift) => ({
      queryKey: supervisionActivityKey(range, granularity, projet, shift),
      queryFn: () =>
        fetchSupervisionActivite({
          range,
          granularity,
          projet,
          shift: { start: shift.start, end: shift.end },
        }),
      placeholderData: keepPreviousData,
    })),
  });
  const [draft, setDraft] = useState<UpdateWorkShifts | null>(null);

  const save = useMutation({
    mutationFn: (body: UpdateWorkShifts) => updateWorkShifts(body),
    onSuccess: async (next: WorkShifts) => {
      queryClient.setQueryData(['supervision', 'creneaux'], next);
      await queryClient.invalidateQueries({ queryKey: ['supervision', 'activite'] });
      setDraft(null);
    },
  });

  if (shiftsQuery.isPending || shifts.length === 0) return null;

  type ApiCounts = SupervisionActivity['totals'];
  const callsOf = (counts: ApiCounts): number =>
    famille === 'representants' ? counts.repCalls : counts.calls;
  const successOf = (counts: ApiCounts): number =>
    famille === 'representants' ? counts.repReached : counts.methodObtained;
  const rateOf = (counts: ApiCounts): number | null =>
    famille === 'representants' ? counts.repContactRate : counts.reachRate;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 font-display text-[1.0625rem] font-[700]">
              <Clock3Icon className="size-4" aria-hidden="true" />
              Efficacité par créneau
            </h2>
            <p className="mt-1 text-[0.8125rem] text-muted-foreground">
              Appels par heure et résultat des appels, sur la période choisie.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const [morning, afternoon] = shifts;
              if (draft !== null || morning === undefined || afternoon === undefined) {
                setDraft(null);
                return;
              }
              setDraft({
                morningStart: morning.start,
                morningEnd: morning.end,
                afternoonStart: afternoon.start,
                afternoonEnd: afternoon.end,
              });
            }}
          >
            {draft === null ? 'Modifier les horaires' : 'Annuler'}
          </Button>
        </div>

        {draft !== null ? (
          <form
            className="grid gap-4 border-y border-border px-5 py-4 sm:grid-cols-4"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate(draft);
            }}
          >
            <TimeField
              label="Matin, début"
              value={draft.morningStart}
              onChange={(morningStart) => setDraft({ ...draft, morningStart })}
            />
            <TimeField
              label="Matin, fin"
              value={draft.morningEnd}
              onChange={(morningEnd) => setDraft({ ...draft, morningEnd })}
            />
            <TimeField
              label="Après-midi, début"
              value={draft.afternoonStart}
              onChange={(afternoonStart) => setDraft({ ...draft, afternoonStart })}
            />
            <TimeField
              label="Après-midi, fin"
              value={draft.afternoonEnd}
              onChange={(afternoonEnd) => setDraft({ ...draft, afternoonEnd })}
            />
            <div className="sm:col-span-4">
              <Button type="submit" size="sm" disabled={save.isPending}>
                Enregistrer
              </Button>
              {save.isError ? (
                <p className="mt-2 text-[0.8125rem] text-destructive">
                  Horaires invalides. Vérifiez leur ordre et leur chevauchement.
                </p>
              ) : null}
            </div>
          </form>
        ) : null}

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Créneau</TableHead>
              <TableHead className="text-right">Appels</TableHead>
              <TableHead className="text-right">Appels/h</TableHead>
              <TableHead className="text-right">
                {famille === 'representants' ? 'Joints' : 'Méthodes'}
              </TableHead>
              <TableHead className="text-right">Taux</TableHead>
              <TableHead className="text-right">Prospects saisis</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shifts.map((shift, index) => {
              const counts = results[index]?.data?.totals;
              const duration = (shiftMinutes(shift.start, shift.end) / 60) * rangeDays(range);
              const calls = counts === undefined ? 0 : callsOf(counts);
              return (
                <TableRow key={shift.key}>
                  <TableCell className="font-[600]">
                    {shift.label} · {shift.start}–{shift.end}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(calls)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatDecimal(duration === 0 ? 0 : calls / duration)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(counts === undefined ? 0 : successOf(counts))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatRateOrNone(counts === undefined ? null : rateOf(counts))}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(counts?.prospectsCreated ?? 0)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `shift-${label.toLocaleLowerCase().replaceAll(/[^a-z]+/gu, '-')}`;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="time"
        value={value}
        required
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

function shiftMinutes(start: string, end: string): number {
  const [startHour = 0, startMinute = 0] = start.split(':').map(Number);
  const [endHour = 0, endMinute = 0] = end.split(':').map(Number);
  return endHour * 60 + endMinute - startHour * 60 - startMinute;
}

function rangeDays(range: ActivityRange): number {
  const from = Date.parse(`${range.from}T00:00:00.000Z`);
  const to = Date.parse(`${range.to}T00:00:00.000Z`);
  return Math.max(1, Math.floor((to - from) / 86_400_000) + 1);
}

function dureeAffichee(secondes: number): string {
  const minutes = Math.floor(secondes / 60);
  const reste = Math.round(secondes % 60);
  if (minutes === 0) return `${formatNumber(reste)} s`;
  return `${formatNumber(minutes)} min ${String(reste).padStart(2, '0')}`;
}

function valeurAffichee(colonne: ActivityColumn, valeur: number | null, decimal = false): string {
  if (colonne.taux === true) return formatRateOrNone(valeur);
  if (colonne.duree === true) return valeur === null ? 'Sans objet' : dureeAffichee(valeur);
  const nombre = valeur ?? 0;
  return decimal ? formatDecimal(nombre) : formatNumber(nombre);
}

function Cellule({
  colonne,
  valeur,
  decimal = false,
  anime = false,
}: {
  colonne: ActivityColumn;
  valeur: number | null;
  decimal?: boolean;
  anime?: boolean;
}) {
  return (
    <TableCell className={cn('text-right', valeur === null && 'text-muted-foreground')}>
      {anime && valeur !== null ? (
        <AnimatedNumber
          value={valeur}
          format={(nombre) => valeurAffichee(colonne, nombre, decimal)}
        />
      ) : (
        valeurAffichee(colonne, valeur, decimal)
      )}
    </TableCell>
  );
}

function ActivityRow({ line, colonnes }: { line: ActivityLine; colonnes: ActivityColumn[] }) {
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
      {colonnes.map((colonne) => (
        <Cellule key={colonne.key} colonne={colonne} valeur={line[colonne.key]} />
      ))}
    </TableRow>
  );
}

function TotalsRow({
  label,
  values,
  colonnes,
  decimal = false,
}: {
  label: string;
  values: ActivityCounts;
  colonnes: ActivityColumn[];
  decimal?: boolean;
}) {
  return (
    <TableRow className="hover:bg-transparent">
      <th scope="row" className="px-3 py-2.5 text-left font-[600]">
        {label}
      </th>
      {colonnes.map((colonne) => (
        <Cellule
          key={colonne.key}
          colonne={colonne}
          valeur={values[colonne.key]}
          decimal={decimal}
          anime
        />
      ))}
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
  format,
  icon: Icon,
  index,
}: {
  label: string;
  value: number | null;
  format: (valeur: number | null) => string;
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
            {value === null ? format(null) : <AnimatedNumber value={value} format={format} />}
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
