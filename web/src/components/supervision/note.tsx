import { ChevronRightIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import type { NoteDeRendement } from '@/lib/data/supervision';
import { formatDecimal, formatRate } from '@/lib/format';

const RAISONS: Record<string, string> = {
  journee_non_commencee: 'Journée pas commencée',
  presence_non_mesuree: 'Présence non mesurée',
  aucun_appel: 'Aucun appel',
};

const TITRE_SECTION =
  'mb-1 text-[0.75rem] font-[600] uppercase tracking-wide text-muted-foreground';

function tonalite(valeur: number): 'success' | 'warning' | 'destructive' {
  if (valeur >= 75) return 'success';
  if (valeur >= 50) return 'warning';
  return 'destructive';
}

export function BadgeNote({ note }: { note: NoteDeRendement }) {
  if (note.value === null) {
    return (
      <Badge variant="outline">
        {note.reason === null || note.reason === undefined
          ? 'Sans objet'
          : (RAISONS[note.reason] ?? 'Sans objet')}
      </Badge>
    );
  }

  return (
    <Badge variant={tonalite(note.value)} className="tabular-nums">
      {Math.round(note.value)}
    </Badge>
  );
}

/** Une note absente n'est pas une note basse : -1 la range derrière le zéro. */
export function parNoteDecroissante<T extends { score: NoteDeRendement }>(
  lignes: readonly T[],
): T[] {
  return [...lignes].sort((a, b) => (b.score.value ?? -1) - (a.score.value ?? -1));
}

export function appelsParHeure(appels: number, secondesEnCreneau: number): string {
  if (secondesEnCreneau === 0) return 'Sans objet';
  return formatDecimal(appels / (secondesEnCreneau / 3600));
}

export function BasculeNote({
  ouvert,
  onBascule,
  children,
}: {
  ouvert: boolean;
  onBascule: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-expanded={ouvert}
      onClick={onBascule}
      className="flex w-full items-center gap-2 rounded-md text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <ChevronRightIcon
        className={`size-4 shrink-0 text-muted-foreground transition-transform duration-(--dur-2) ease-(--ease-out-cpi) ${ouvert ? 'rotate-90' : ''}`}
        aria-hidden="true"
      />
      <span>{children}</span>
    </button>
  );
}

export function Faits({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section>
      <h3 className={TITRE_SECTION}>{titre}</h3>
      <dl className="flex flex-col gap-1">{children}</dl>
    </section>
  );
}

export function Fait({
  label,
  valeur,
  note,
}: {
  label: string;
  valeur: string;
  note?: string | undefined;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">
        {valeur}
        {note === undefined ? null : (
          <span className="ml-2 text-[0.75rem] text-muted-foreground">{note}</span>
        )}
      </dd>
    </div>
  );
}

export function DetailNote({ parts }: { parts: NoteDeRendement['parts'] }) {
  const criteres = parts ?? [];
  if (criteres.length === 0) return null;

  return (
    <Faits titre="Détail de la note">
      {criteres.map((critere) => (
        <Fait
          key={critere.key}
          label={critere.label}
          valeur={formatRate(Math.round(critere.ratio * 100))}
          note={`poids ${formatRate(Math.round(critere.weight * 100))}`}
        />
      ))}
    </Faits>
  );
}
