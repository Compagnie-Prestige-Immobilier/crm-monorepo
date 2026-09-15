import type { ReactNode } from 'react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ProjetBadge } from '@/components/prospects/projet-badge';
import { formatPhone, initials, SANS_NUMERO } from '@/lib/format';
import type { Projet } from '@/lib/types';

export interface ChiffreDeFiche {
  label: string;
  valeur: string;
  precision?: string | null;
}

/** L'en-tête commun des fiches : qui, son numéro, où il en est, et trois chiffres. */
export function FicheEnTete({
  nom,
  complement,
  phoneE164,
  badges,
  projet,
  actions,
  chiffres,
}: {
  nom: string;
  complement?: string | null;
  phoneE164: string | null;
  badges: ReactNode;
  projet?: Projet;
  actions?: ReactNode;
  chiffres: readonly ChiffreDeFiche[];
}) {
  return (
    <header className="animate-rise flex flex-col gap-5 rounded-lg border border-border bg-card p-5 shadow-elev-sm">
      <div className="flex flex-wrap items-start gap-4">
        <Avatar className="size-14 font-display text-[1.125rem]">
          <AvatarFallback>{initials(nom)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[1.5rem] leading-tight font-[800] tracking-[-0.02em]">
            {nom}
            {complement === null || complement === undefined || complement === '' ? null : (
              <span className="ml-2 text-[1rem] font-[400] text-muted-foreground">
                {complement}
              </span>
            )}
          </h2>
          {phoneE164 === null ? (
            <span className="text-[0.9375rem] text-muted-foreground italic">{SANS_NUMERO}</span>
          ) : (
            <a
              href={`tel:${phoneE164}`}
              className="text-[0.9375rem] tabular-nums text-muted-foreground underline-offset-4 hover:underline"
            >
              {formatPhone(phoneE164)}
            </a>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {projet === undefined ? null : <ProjetBadge projet={projet} />}
            {badges}
          </div>
        </div>
        {actions === undefined ? null : (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
      <dl className="grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
        {chiffres.map((chiffre) => (
          <div key={chiffre.label} className="min-w-0">
            <dt className="eyebrow text-muted-foreground">{chiffre.label}</dt>
            <dd className="font-display text-[1.25rem] font-[800] tracking-[-0.02em] tabular-nums">
              {chiffre.valeur}
            </dd>
            {chiffre.precision === null || chiffre.precision === undefined ? null : (
              <dd className="text-[0.75rem] text-muted-foreground">{chiffre.precision}</dd>
            )}
          </div>
        ))}
      </dl>
    </header>
  );
}
