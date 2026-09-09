import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { HeadsetIcon, LandmarkIcon } from 'lucide-react';

import { formatPresence } from '@/components/supervision/colonnes';
import { CarteEtat, TablePresence } from '@/components/supervision/presence-table';
import { QueryErrorState } from '@/components/query-error-state';
import { Skeleton } from '@/components/ui/skeleton';
import { fetchPresence } from '@/lib/data/presence';
import { liveInterval, LIVE_SLOW_INTERVAL_MS } from '@/lib/live';

export function VuePresence() {
  const presence = useQuery({
    queryKey: ['supervision', 'presence'],
    queryFn: fetchPresence,
    refetchInterval: liveInterval(
      { hidden: false, failing: false, paused: false },
      LIVE_SLOW_INTERVAL_MS,
    ),
    placeholderData: keepPreviousData,
  });

  if (presence.isError && presence.data === undefined) {
    return (
      <QueryErrorState
        error={presence.error}
        onRetry={() => {
          void presence.refetch();
        }}
        fallback="La liste des comptes n’a pas pu être lue. Réessayez."
      />
    );
  }

  if (presence.data === undefined) return <Skeleton className="h-64 w-full rounded-lg" />;

  const data = presence.data;
  const creneaux = (data.shifts ?? []).map(
    (creneau) => `${creneau.label} ${creneau.start}-${creneau.end}`,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-[0.9375rem] text-muted-foreground">
          Présence observée par l’application. Les appels et saisies sont dans le volet Activité.
        </p>
        {creneaux.length > 0 ? (
          <p className="text-[0.8125rem] text-muted-foreground">
            Rendement calculé sur {creneaux.join(' et ')},{' '}
            {formatPresence(data.shiftSecondsElapsed)} écoulées.
          </p>
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <CarteEtat index={0} label="Connectés" valeur={data.counts.online} ton="success" />
        <CarteEtat index={1} label="Récents" valeur={data.counts.recent} ton="info" />
        <CarteEtat index={2} label="Inactifs" valeur={data.counts.away} ton="muted" />
      </div>

      <TablePresence
        icon={HeadsetIcon}
        titre="Téléconseillers"
        comptes={data.teleconseillers ?? []}
        observedAt={data.observedAt}
        vide="Aucun compte téléconseiller."
      />

      <TablePresence
        icon={LandmarkIcon}
        titre="Banque & Finance"
        comptes={data.finances ?? []}
        observedAt={data.observedAt}
        vide="Aucun compte au pôle Banque & Finance."
      />
    </div>
  );
}
