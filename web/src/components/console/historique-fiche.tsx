'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { ArrowRightLeftIcon, HistoryIcon, PhoneCallIcon, type LucideIcon } from 'lucide-react';
import { useState } from 'react';

import { QueryErrorInline } from '@/components/query-error-state';
import { Skeleton } from '@/components/ui/skeleton';
import {
  fetchProspectCallAttempts,
  fetchProspectRequalifications,
  type ProspectCallAttempt,
  type ProspectRequalification,
} from '@/lib/data/prospects';
import { formatDateTime } from '@/lib/format';
import { CALL_OUTCOME_LABELS, PHASE2_STATUS_LABELS, type Phase2Status } from '@/lib/types';

interface Evenement {
  id: string;
  at: string;
  icone: LucideIcon;
  titre: string;
  auteur: string;
  note: string | null;
}

const libelleStatut = (code: string): string => PHASE2_STATUS_LABELS[code as Phase2Status] ?? code;

function evenementAppel(appel: ProspectCallAttempt): Evenement {
  return {
    id: `appel-${appel.id}`,
    at: appel.clientCreatedAt,
    icone: PhoneCallIcon,
    titre: appel.reasonLabel ?? CALL_OUTCOME_LABELS[appel.outcome],
    auteur: appel.performedByName,
    note: appel.comment === '' ? null : appel.comment,
  };
}

function evenementStatut(ligne: ProspectRequalification): Evenement {
  return {
    id: `statut-${ligne.id}`,
    at: ligne.le,
    icone: ArrowRightLeftIcon,
    titre: `${libelleStatut(ligne.de)} vers ${libelleStatut(ligne.vers)}`,
    auteur: ligne.parNom ?? 'Auteur inconnu',
    note: null,
  };
}

/**
 * Appels et changements de statut dans une seule frise : replié tant qu'on ne
 * l'ouvre pas, il ne charge rien et ne pousse pas l'écran d'appel vers le bas.
 */
export function HistoriqueFiche({ prospectId }: { prospectId: string }) {
  const [ouvert, setOuvert] = useState(false);

  const appels = useQuery({
    queryKey: ['prospects', 'call-attempts', prospectId],
    queryFn: () => fetchProspectCallAttempts(prospectId),
    enabled: ouvert,
  });
  const statuts = useQuery({
    queryKey: ['prospects', 'requalifications', prospectId],
    queryFn: () => fetchProspectRequalifications(prospectId),
    enabled: ouvert,
  });

  const evenements: Evenement[] = [
    ...(appels.data ?? []).map(evenementAppel),
    ...(statuts.data ?? []).map(evenementStatut),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <details
      open={ouvert}
      onToggle={(event) => {
        setOuvert(event.currentTarget.open);
      }}
    >
      <summary className="flex min-h-11 w-fit cursor-pointer list-none items-center gap-2 rounded-md text-[0.9375rem] font-[600] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <HistoryIcon className="size-4 shrink-0" aria-hidden="true" />
        Historique de la fiche
      </summary>
      <div className="pt-3">
        <Corps sources={[appels, statuts]} evenements={evenements} />
      </div>
    </details>
  );
}

function Corps({
  sources,
  evenements,
}: {
  sources: readonly UseQueryResult<unknown>[];
  evenements: readonly Evenement[];
}) {
  const enErreur = sources.find((source) => source.isError);
  if (enErreur !== undefined) {
    return (
      <QueryErrorInline
        error={enErreur.error}
        onRetry={() => {
          void enErreur.refetch();
        }}
        fallback="L’historique de cette fiche n’a pas pu être chargé."
      />
    );
  }

  if (sources.some((source) => source.isPending)) {
    return <Skeleton className="h-20 w-full" />;
  }

  if (evenements.length === 0) {
    return <Vide />;
  }

  return (
    <ol aria-label="Historique de la fiche" className="flex flex-col gap-3">
      {evenements.map((evenement) => (
        <Ligne key={evenement.id} evenement={evenement} />
      ))}
    </ol>
  );
}

function Vide() {
  return (
    <p className="rounded-md border border-dashed border-border px-4 py-5 text-center text-[0.875rem] text-muted-foreground">
      Rien de consigné sur cette fiche. Enregistrez cet appel ci-dessus, il ouvrira l’historique.
    </p>
  );
}

function Ligne({ evenement }: { evenement: Evenement }) {
  const Icone = evenement.icone;
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
      >
        <Icone className="size-3.5" />
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[0.9375rem] font-[600]">{evenement.titre}</span>
        <span className="text-[0.8125rem] text-muted-foreground">
          <time dateTime={evenement.at} className="tabular-nums">
            {formatDateTime(evenement.at)}
          </time>
          {' · '}
          {evenement.auteur}
        </span>
        {evenement.note === null ? null : (
          <span className="text-[0.875rem] break-words">{evenement.note}</span>
        )}
      </span>
    </li>
  );
}
