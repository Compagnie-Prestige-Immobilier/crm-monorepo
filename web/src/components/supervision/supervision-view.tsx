'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { HeadsetIcon, LandmarkIcon, type LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { AnimatedNumber } from '@/components/live/animated-number';
import { LiveIndicator } from '@/components/live/live-indicator';
import { useLive } from '@/components/live/use-live';
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
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TablePaginationLocale, usePaginationLocale } from '@/components/ui/table-pagination';
import {
  PRESENCE_LABELS,
  fetchSupervision,
  formatActiveDuration,
  formatClock,
  formatDuration,
  formatElapsed,
  knownPresence,
  minutesSince,
  type PresenceState,
  type SupervisedUser,
} from '@/lib/data/admin';
import { formatNumber } from '@/lib/format';
import { LIVE_SLOW_INTERVAL_MS, shouldShowError, shouldShowSkeleton } from '@/lib/live';
import { queryKeys } from '@/lib/query-keys';

const PRESENCE_VARIANT: Record<PresenceState, 'success' | 'info' | 'secondary'> = {
  ONLINE: 'success',
  RECENT: 'info',
  AWAY: 'secondary',
};

const COLUMNS = 6;

function PresenceBadge({ presence }: { presence: string }) {
  const state = knownPresence(presence);
  return <Badge variant={PRESENCE_VARIANT[state]}>{PRESENCE_LABELS[state]}</Badge>;
}

function formatDeadTime(seconds: number, gaps: number): string {
  if (gaps === 0) return 'Aucun';
  return `${formatDuration(seconds)} sur ${formatNumber(gaps)} trou${gaps > 1 ? 's' : ''}`;
}

export function SupervisionView() {
  const live = useLive({ intervalMs: LIVE_SLOW_INTERVAL_MS });

  const supervision = useQuery({
    queryKey: queryKeys.supervision,
    queryFn: () => fetchSupervision(),
    refetchInterval: live.refetchInterval,
    placeholderData: keepPreviousData,
  });

  const data = supervision.data;

  if (shouldShowError({ isError: supervision.isError, hasData: data !== undefined })) {
    return (
      <QueryErrorState
        error={supervision.error}
        onRetry={() => {
          void supervision.refetch();
        }}
        fallback="La liste des comptes n’a pas pu être lue. Réessayez."
      />
    );
  }

  if (shouldShowSkeleton({ isPending: supervision.isPending, hasData: data !== undefined })) {
    return <SupervisionSkeleton />;
  }

  if (data === undefined) return <SupervisionSkeleton />;

  const creneaux = data.shifts.map((shift) => `${shift.label} ${shift.start}-${shift.end}`);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-[0.9375rem] text-muted-foreground">
            Présence observée par l’application. Les appels et saisies sont dans le volet Activité.
          </p>
          {creneaux.length > 0 ? (
            <p className="text-[0.8125rem] text-muted-foreground">
              Rendement calculé sur {creneaux.join(' et ')},{' '}
              {formatActiveDuration(data.shiftSecondsElapsed)} écoulées.
            </p>
          ) : null}
        </div>
        <LiveIndicator
          state={live.stateOf(supervision.isError)}
          label={live.labelOf(supervision.isError)}
          updatedAt={supervision.dataUpdatedAt}
          onTogglePause={live.togglePause}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <PresenceCard index={0} label="Connectés" value={data.counts.online} tone="success" />
        <PresenceCard index={1} label="Récents" value={data.counts.recent} tone="info" />
        <PresenceCard index={2} label="Inactifs" value={data.counts.away} tone="muted" />
      </div>

      <PresenceTable
        icon={HeadsetIcon}
        title="Téléconseillers"
        users={data.teleconseillers}
        observedAt={data.observedAt}
        empty="Aucun compte téléconseiller."
      />

      {/* « Banque & Finance », comme partout ailleurs dans le panel : c'est le
          libellé de `ROLE_LABELS`, celui du formulaire de compte et celui de la
          barre latérale. Cet écran disait « Finances générales », un nom qui
          n'existe nulle part ailleurs et qui laissait croire à un troisième
          pôle. */}
      <PresenceTable
        icon={LandmarkIcon}
        title="Banque & Finance"
        users={data.finances}
        observedAt={data.observedAt}
        empty="Aucun compte au pôle Banque & Finance."
      />
    </div>
  );
}

function PresenceCard({
  label,
  value,
  tone,
  index,
}: {
  label: string;
  value: number;
  tone: 'success' | 'info' | 'muted';
  index: number;
}) {
  const color = {
    success: 'text-success',
    info: 'text-info',
    muted: 'text-muted-foreground',
  }[tone];

  return (
    <Card className="animate-rise" style={{ animationDelay: `${String(index * 60)}ms` }}>
      <CardContent>
        <p className="truncate text-[0.75rem] font-[600] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <AnimatedNumber
          value={value}
          className={`mt-1 block font-display text-[1.75rem] font-[800] leading-none tracking-[-0.02em] tabular-nums ${color}`}
        />
      </CardContent>
    </Card>
  );
}

function PresenceTable({
  icon: Icon,
  title,
  users,
  observedAt,
  empty,
}: {
  icon: LucideIcon;
  title: string;
  users: SupervisedUser[];
  observedAt: string;
  empty: string;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const pagination = usePaginationLocale(byScoreDesc(users));

  return (
    <Card className="animate-rise">
      <CardContent className="overflow-x-auto scrollbar-thin p-0">
        <table className="w-full text-[0.875rem]">
          <caption className="flex items-center gap-2 px-5 py-3 text-left font-display text-[1.0625rem] font-[700] tracking-[-0.02em]">
            <Icon className="size-4" aria-hidden="true" />
            {title}
            <span className="font-sans text-[0.8125rem] font-[400] text-muted-foreground tabular-nums">
              {users.length}
            </span>
          </caption>
          <thead className="border-b border-border">
            <tr>
              <th scope="col" className="px-5 py-2 text-left font-[600]">
                Compte
              </th>
              <th scope="col" className="px-5 py-2 text-left font-[600]">
                État
              </th>
              <th scope="col" className="px-5 py-2 text-left font-[600]">
                Rendement
              </th>
              <th scope="col" className="px-5 py-2 text-right font-[600]">
                Temps actif aujourd’hui
              </th>
              <th scope="col" className="px-5 py-2 text-right font-[600]">
                Appels aujourd’hui
              </th>
              <th scope="col" className="px-5 py-2 text-right font-[600]">
                En attente
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {pagination.pageLignes.map((user) => {
              const open = openId === user.id;
              return (
                <PresenceRows
                  key={user.id}
                  user={user}
                  observedAt={observedAt}
                  open={open}
                  onToggle={() => {
                    setOpenId(open ? null : user.id);
                  }}
                />
              );
            })}
            {users.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS} className="px-5 py-6 text-center text-muted-foreground">
                  {empty}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
        <TablePaginationLocale
          page={pagination.page}
          pageCount={pagination.pageCount}
          pageSize={pagination.pageSize}
          setPage={pagination.setPage}
          setPageSize={pagination.setPageSize}
        />
      </CardContent>
    </Card>
  );
}

function PresenceRows({
  user,
  observedAt,
  open,
  onToggle,
}: {
  user: SupervisedUser;
  observedAt: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr className="transition-colors duration-(--dur-2) ease-(--ease-out-cpi)">
        <th scope="row" className="px-5 py-2 text-left font-[400]">
          <ScoreToggle open={open} onToggle={onToggle}>
            <span className="block font-[600]">{user.fullName}</span>
            <span className="block text-[0.75rem] text-muted-foreground">{user.username}</span>
          </ScoreToggle>
        </th>
        <td className="px-5 py-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <PresenceBadge presence={user.presence} />
            {!user.isActive ? <Badge variant="outline">Désactivé</Badge> : null}
            {user.journalAppelsAutorise === false ? (
              <Badge variant="outline">Journal d’appels refusé</Badge>
            ) : null}
          </div>
        </td>
        <td className="px-5 py-2">
          <ScoreBadge score={user.score} />
        </td>
        <td className="px-5 py-2 text-right tabular-nums">
          <AnimatedNumber value={user.activeSecondsToday} format={formatActiveDuration} />
        </td>
        <td className="px-5 py-2 text-right tabular-nums">
          <AnimatedNumber value={user.callsToday} />
        </td>
        <td className="px-5 py-2 text-right tabular-nums">
          {user.pendingOps === null ? 'Inconnu' : user.pendingOps}
        </td>
      </tr>
      {open ? <DetailRow user={user} observedAt={observedAt} /> : null}
    </>
  );
}

function DetailRow({ user, observedAt }: { user: SupervisedUser; observedAt: string }) {
  return (
    <tr className="bg-muted/40">
      <td colSpan={COLUMNS} className="px-5 pb-4 pt-2">
        <div className="grid gap-x-10 gap-y-4 md:grid-cols-2">
          <ScoreFacts title="Journée">
            <Fact
              label="Dernier signal"
              value={formatElapsed(minutesSince(user.lastSeenAt, observedAt))}
            />
            <Fact label="Premier appel" value={formatClock(user.firstCallAt)} />
            <Fact label="Dernier appel" value={formatClock(user.lastCallAt)} />
            <Fact
              label="Appels par heure active"
              value={callsPerActiveHour(user.callsToday, user.activeSecondsInShifts)}
            />
            <Fact label="Cadence médiane" value={formatDuration(user.medianGapSeconds)} />
            <Fact label="Temps mort" value={formatDeadTime(user.deadSeconds, user.deadGaps)} />
            <Fact label="Reprises" value={formatNumber(user.repeatCalls)} />
            <Fact
              label="Dernière saisie"
              value={formatElapsed(minutesSince(user.lastWriteAt, observedAt))}
            />
          </ScoreFacts>

          <ScoreParts parts={user.score.parts} />
        </div>
      </td>
    </tr>
  );
}

export function SupervisionSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <div className="grid gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <Card key={index}>
            <CardContent>
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-7 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
      {[0, 1].map((index) => (
        <Card key={index}>
          <CardContent className="flex flex-col gap-3 p-5">
            <Skeleton className="h-4 w-40" />
            {[0, 1, 2, 3].map((row) => (
              <Skeleton key={row} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
