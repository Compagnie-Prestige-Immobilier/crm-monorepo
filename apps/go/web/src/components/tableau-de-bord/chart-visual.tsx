import { CheckIcon } from 'lucide-react';
import { useState } from 'react';

import { APERCUS } from '@/components/tableau-de-bord/apercus';
import { CSS_APERCU } from '@/components/tableau-de-bord/apercus-pieces';
import { TEXTES_MARQUE } from '@/components/tableau-de-bord/apercus-textes';
import type { Marque } from '@/components/tableau-de-bord/sources';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export function texteMarque(marque: Marque): { nom: string; usage: string } {
  return TEXTES_MARQUE[marque];
}

export function ApercuGraphique({
  marque,
  className,
}: {
  marque: Marque;
  className?: string | undefined;
}) {
  return (
    <span
      aria-hidden="true"
      data-marque={marque}
      className={cn(
        'inline-flex size-12 shrink-0 items-center justify-center rounded-md border border-border/60 bg-card',
        className,
      )}
    >
      <style href="cpi-apercu-graphique" precedence="default">
        {CSS_APERCU}
      </style>
      <svg viewBox="0 0 40 40" className="size-10" focusable="false">
        {APERCUS[marque]}
      </svg>
    </span>
  );
}

export function ExempleGraphique({ marque }: { marque: Marque }) {
  const texte = texteMarque(marque);

  return (
    <div className="flex items-center gap-3 rounded-md bg-secondary/60 p-3">
      <span
        role="img"
        aria-label={`Exemple visuel : ${texte.nom}`}
        className="flex min-w-0 flex-1 items-center justify-center"
      >
        <ApercuGraphique
          marque={marque}
          className="size-36 border-border bg-card [&>svg]:size-32"
        />
      </span>
      <div className="w-36 shrink-0">
        <p className="text-[0.75rem] font-[700] uppercase tracking-[0.08em] text-muted-foreground">
          Exemple visuel
        </p>
        <p className="mt-1 font-display text-[1rem] font-[700]">{texte.nom}</p>
        <p className="mt-1 text-[0.8125rem] text-muted-foreground">{texte.usage}</p>
      </div>
    </div>
  );
}

export function ChoixGraphique({
  marque,
  conseille = false,
  raison = null,
  selectionne = false,
  onSelect,
}: {
  marque: Marque;
  conseille?: boolean;
  raison?: string | null;
  selectionne?: boolean;
  onSelect: () => void;
}) {
  const [rejeu, setRejeu] = useState(0);
  const texte = texteMarque(marque);
  const rejouer = (): void => {
    setRejeu((tour) => tour + 1);
  };

  return (
    <button
      type="button"
      aria-pressed={selectionne}
      onClick={onSelect}
      onPointerEnter={rejouer}
      onFocus={rejouer}
      className={cn(
        // `shrink-0` : dans une colonne qui défile, un enfant flex se comprime
        // sous sa hauteur de contenu et les lignes se chevauchent.
        'flex min-h-11 w-full shrink-0 items-start gap-3 rounded-md border p-2 text-left',
        'hover:bg-secondary focus-visible:bg-secondary',
        selectionne ? 'border-primary bg-secondary' : 'border-transparent',
      )}
    >
      <ApercuGraphique key={rejeu} marque={marque} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 py-0.5">
        <span className="flex items-center gap-1.5 text-[0.9375rem] font-[600]">
          <span className="min-w-0 truncate">{texte.nom}</span>
          {selectionne ? (
            <CheckIcon className="size-4 shrink-0 text-primary" aria-hidden="true" />
          ) : null}
        </span>
        <span className="text-[0.8125rem] text-muted-foreground">{texte.usage}</span>
        {conseille ? (
          <Badge variant="warning" className="mt-0.5">
            Conseillé ici
          </Badge>
        ) : null}
        {raison === null ? null : (
          <span className="text-[0.75rem] text-muted-foreground">{raison}</span>
        )}
      </span>
    </button>
  );
}
