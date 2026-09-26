'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRightIcon } from 'lucide-react';

import { fetchProspectSegmentHistory } from '@/lib/data/prospects';
import { formatDateTime, formatNumber } from '@/lib/format';
import { SEGMENT_LABELS } from '@/lib/types';

export function ProspectSegmentHistory({ prospectId }: { prospectId: string }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['prospects', 'segment-history', prospectId],
    queryFn: () => fetchProspectSegmentHistory(prospectId),
  });

  if (isPending) {
    return (
      <p className="text-[0.75rem] text-muted-foreground">Chargement de l’historique de segment…</p>
    );
  }

  if (isError) {
    return (
      <p role="alert" className="text-[0.75rem] text-destructive">
        L’historique de segment n’a pas pu être chargé.
      </p>
    );
  }

  if (data.items.length === 0) {
    return (
      <p className="text-[0.75rem] text-muted-foreground">
        Cette fiche n’a jamais changé de segment.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[0.75rem] font-[600]">Bascules déjà enregistrées</p>
      <ul className="flex flex-col gap-2">
        {data.items.map((change) => (
          <li key={change.id} className="rounded-md border border-border px-3 py-2">
            <p className="flex flex-wrap items-center gap-1.5 text-[0.8125rem]">
              <span>{SEGMENT_LABELS[change.fromSegment]}</span>
              <ArrowRightIcon className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="font-[600]">{SEGMENT_LABELS[change.toSegment]}</span>
            </p>
            <p className="text-[0.75rem] text-muted-foreground">
              {formatDateTime(change.changedAt)} · {change.changedByName}
            </p>
            {change.reason === null ? null : (
              <p className="mt-1 text-[0.75rem]">« {change.reason} »</p>
            )}
          </li>
        ))}
      </ul>
      {data.tronque ? (
        <p className="text-[0.75rem] text-muted-foreground">
          Liste limitée aux {formatNumber(data.items.length)} éléments les plus récents.
        </p>
      ) : null}
    </div>
  );
}
