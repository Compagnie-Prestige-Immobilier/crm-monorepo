'use client';

import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { HeadsetIcon, LandmarkIcon, type LucideIcon } from 'lucide-react';

import { AnimatedNumber } from '@/components/live/animated-number';
import { LiveIndicator } from '@/components/live/live-indicator';
import { useLive } from '@/components/live/use-live';
import { QueryErrorState } from '@/components/query-error-state';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PRESENCE_LABELS,
  fetchSupervision,
  formatElapsed,
  minutesSince,
  type PresenceState,
  type SupervisedUser,
} from '@/lib/data/admin';
import { shouldShowError, shouldShowSkeleton } from '@/lib/live';
import { queryKeys } from '@/lib/query-keys';

/**
 * Supervision des comptes.
 *
 * L'écran répond à une seule question : QUI EST LÀ, MAINTENANT. Tout le reste
 * : l'historique, les droits, les mots de passe : vit ailleurs et n'a rien à
 * faire ici.
 *
 * Les colonnes ne racontent pas comment la présence est déduite. Un superviseur
 * n'a que faire des familles de jetons ; il lui faut un état et une ancienneté.
 * Le mécanisme est documenté côté API (`presence.ts`), là où il se modifie.
 */

const PRESENCE_VARIANT: Record<PresenceState, 'success' | 'info' | 'secondary'> = {
  ONLINE: 'success',
  RECENT: 'info',
  AWAY: 'secondary',
};

export function SupervisionView() {
  const live = useLive();

  const supervision = useQuery({
    queryKey: queryKeys.supervision,
    queryFn: () => fetchSupervision(),
    refetchInterval: live.refetchInterval,
    // L'ancienne liste reste affichée pendant le cycle suivant : sans cela,
    // l'écran repasserait par un squelette toutes les dix secondes.
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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.9375rem] text-muted-foreground">
          Présence et dernière activité des comptes.
        </p>
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

      <PresenceTable
        icon={LandmarkIcon}
        title="Finances générales"
        users={data.finances}
        observedAt={data.observedAt}
        empty="Aucun compte au pôle Finances générales."
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
  const color =
    tone === 'success' ? 'text-success' : tone === 'info' ? 'text-info' : 'text-muted-foreground';

  return (
    <Card className="animate-rise" style={{ animationDelay: `${String(index * 60)}ms` }}>
      <CardContent>
        <p className="truncate text-[0.75rem] font-[600] uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <AnimatedNumber
          value={value}
          // `tabular-nums` : sans lui, la largeur des chiffres change et la
          // carte se décale à chaque image de l'interpolation.
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
              <th scope="col" className="px-5 py-2 text-right font-[600]">
                Activité
              </th>
              <th scope="col" className="px-5 py-2 text-right font-[600]">
                Sessions
              </th>
              <th scope="col" className="px-5 py-2 text-right font-[600]">
                Synchro
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.map((user) => (
              <tr
                key={user.id}
                // La transition porte sur la couleur seule : rien ne bouge de
                // place quand un compte change d'état.
                className="transition-colors duration-(--dur-2) ease-(--ease-out-cpi)"
              >
                <th scope="row" className="px-5 py-2 text-left font-[400]">
                  <span className="block font-[600]">{user.fullName}</span>
                  <span className="block text-[0.75rem] text-muted-foreground">
                    {user.username}
                    {user.departementName !== null ? ` · ${user.departementName}` : ''}
                  </span>
                </th>
                <td className="px-5 py-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant={PRESENCE_VARIANT[user.presence]}>
                      {PRESENCE_LABELS[user.presence]}
                    </Badge>
                    {!user.isActive ? <Badge variant="outline">Désactivé</Badge> : null}
                  </div>
                </td>
                <td className="px-5 py-2 text-right tabular-nums">
                  {formatElapsed(minutesSince(user.lastSeenAt, observedAt))}
                </td>
                <td className="px-5 py-2 text-right tabular-nums">{user.sessionCount}</td>
                <td className="px-5 py-2 text-right tabular-nums text-muted-foreground">
                  {formatElapsed(minutesSince(user.lastSyncAt, observedAt))}
                </td>
              </tr>
            ))}
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-6 text-center text-muted-foreground">
                  {empty}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </CardContent>
    </Card>
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
