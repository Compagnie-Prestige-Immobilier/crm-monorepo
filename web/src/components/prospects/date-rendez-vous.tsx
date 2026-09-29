import type { ReactNode } from 'react';

import { formatDateTime } from '@/lib/format';

/**
 * La colonne « Date de rendez-vous » de tous les tableaux de prospects : la date
 * que montre l'écran Rendez-vous (`dateRendezVous`), au même rendu partout.
 */
export function DateRendezVous({ at, vide }: { at: string | null; vide: ReactNode }) {
  if (at === null) return vide;
  return (
    <time dateTime={at} className="whitespace-nowrap tabular-nums" title={formatDateTime(at)}>
      {formatDateTime(at)}
    </time>
  );
}
