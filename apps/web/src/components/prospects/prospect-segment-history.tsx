'use client';

import { useQuery } from '@tanstack/react-query';
import { ArrowRightIcon } from 'lucide-react';

import { fetchProspectSegmentHistory } from '@/lib/data/prospects';
import { formatDateTime } from '@/lib/format';
import { SEGMENT_LABELS } from '@/lib/types';

/**
 * L'historique des bascules d'UNE fiche.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * POURQUOI IL EST ICI, SOUS LE FORMULAIRE, ET PAS DANS UN ÉCRAN À PART
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * C'est l'endroit où quelqu'un s'apprête à convertir. Savoir que la fiche a
 * DÉJÀ basculé deux fois ce trimestre, et pour quels motifs, change la décision
 * qu'on est en train de prendre : un aller-retour BDD4 → BDD1 → BDD4 est le
 * signe d'une saisie qui hésite, pas d'une conversion. Rangé dans un écran
 * séparé, personne ne l'ouvrirait avant de cliquer.
 *
 * La clé de cache commence par `prospects` : l'invalidation qui suit une
 * bascule (`queryKeys.prospectsRoot`) emporte donc l'historique avec la liste,
 * et l'encart ne peut pas rester une version en retard sur la fiche.
 */
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

  // Un historique qu'on n'a pas pu lire n'est PAS un historique vide : annoncer
  // « aucune bascule » sur une requête en échec ferait croire à une fiche
  // vierge au moment précis où l'on décide d'en écrire une.
  if (isError) {
    return (
      <p role="alert" className="text-[0.75rem] text-destructive">
        L’historique de segment n’a pas pu être chargé.
      </p>
    );
  }

  if (data.length === 0) {
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
        {data.map((change) => (
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
    </div>
  );
}
