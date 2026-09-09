import { Link } from '@tanstack/react-router';
import { ArrowLeftIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { buttonVariants } from '@/components/ui/button';
import { formatPhone } from '@/lib/format';
import { lien } from '@/lib/nav';
import { cn, initials } from '@/lib/utils';

export interface ChiffreDeFiche {
  label: string;
  valeur: string;
  precision?: string | null;
}

/** `buttonVariants` et non `Button` : la primitive poserait `role="button"` sur le `<a>`. */
export function LienRetour({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link {...lien(href)} className={cn(buttonVariants({ variant: 'ghost' }), 'w-fit -ml-2')}>
      <ArrowLeftIcon aria-hidden="true" />
      {children}
    </Link>
  );
}

/** L'en-tête commun des fiches : qui, son numéro, où il en est, et trois chiffres. */
export function FicheEnTete({
  nom,
  complement,
  phoneE164,
  badges,
  actions,
  chiffres,
}: {
  nom: string;
  complement?: string | null;
  phoneE164: string;
  badges: ReactNode;
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
          <a
            href={`tel:${phoneE164}`}
            className="text-[0.9375rem] tabular-nums text-muted-foreground underline-offset-4 hover:underline"
          >
            {formatPhone(phoneE164)}
          </a>
          <div className="mt-2 flex flex-wrap items-center gap-2">{badges}</div>
        </div>
        {actions === undefined ? null : (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
      <dl className="grid gap-3 border-t border-border pt-4 sm:grid-cols-3">
        {chiffres.map((chiffre) => (
          <div key={chiffre.label} className="min-w-0">
            <dt className="text-[0.75rem] text-muted-foreground">{chiffre.label}</dt>
            <dd className="font-display text-[1.25rem] font-[700] tabular-nums">
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
