'use client';

import { useSyncExternalStore, type ReactNode } from 'react';

import { formatPhone } from '@/lib/format';

const ECRAN_ETROIT = '(max-width: 47.99rem)';

function abonner(prevenir: () => void): () => void {
  const requete = window.matchMedia(ECRAN_ETROIT);
  requete.addEventListener('change', prevenir);
  return () => {
    requete.removeEventListener('change', prevenir);
  };
}

function useEcranEtroit(): boolean {
  return useSyncExternalStore(abonner, () => window.matchMedia(ECRAN_ETROIT).matches);
}

export interface CarteDeListe {
  cle: string;
  titre: ReactNode;
  telephone: string | null;
  statut?: ReactNode;
  details?: ReactNode;
  /** Le geste principal de la ligne, sur toute la largeur de la carte. */
  action?: ReactNode;
}

/** Le tableau sur poste ; sur téléphone, une carte par ligne, sans défilement horizontal. */
export function ListeEnCartes({
  libelle,
  cartes,
  tableau,
}: {
  libelle: string;
  cartes: readonly CarteDeListe[];
  tableau: ReactNode;
}) {
  const etroit = useEcranEtroit();
  if (!etroit) return tableau;

  return (
    <ul aria-label={libelle} className="flex flex-col gap-2">
      {cartes.map((carte) => (
        <li
          key={carte.cle}
          className="flex flex-col gap-2 rounded-lg border border-border bg-card p-3 shadow-elev-xs"
        >
          <div className="flex min-w-0 flex-wrap items-center gap-2 font-[600]">{carte.titre}</div>
          {carte.telephone === null ? (
            <span className="text-[0.875rem] text-muted-foreground italic">Sans numéro</span>
          ) : (
            <a
              href={`tel:${carte.telephone}`}
              className="inline-flex min-h-11 w-fit items-center rounded-sm text-[1rem] font-[600] tabular-nums text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              {formatPhone(carte.telephone)}
            </a>
          )}
          {carte.statut}
          {carte.details}
          {carte.action}
        </li>
      ))}
    </ul>
  );
}
