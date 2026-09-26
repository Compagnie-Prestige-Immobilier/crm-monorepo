import type { ReactNode } from 'react';

import { formatPhone } from '@/lib/format';
import { cn } from '@/lib/utils';

export function NumeroAppel({
  phoneE164,
  className,
}: {
  phoneE164: string | null;
  className?: string | undefined;
}) {
  if (phoneE164 === null || phoneE164 === '') {
    return <span className="text-muted-foreground">{formatPhone(phoneE164)}</span>;
  }
  return (
    <a
      href={`tel:${phoneE164}`}
      className={cn('tabular-nums underline-offset-4 hover:underline', className)}
    >
      {formatPhone(phoneE164)}
    </a>
  );
}

/** La liste sur téléphone ; le tableau de la même page se masque sous `md`. */
export function ListeCartes<T>({
  items,
  libelle,
  cle,
  titre,
  sousTitre,
  numero,
  action,
}: {
  items: readonly T[];
  libelle: string;
  cle: (item: T) => string;
  titre: (item: T) => ReactNode;
  sousTitre?: (item: T) => ReactNode;
  numero: (item: T) => string | null;
  action?: (item: T) => ReactNode;
}) {
  return (
    <ul aria-label={libelle} className="flex flex-col gap-3 md:hidden">
      {items.map((item) => (
        <li
          key={cle(item)}
          className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4 shadow-elev-sm"
        >
          <div className="min-w-0 font-[600] break-words">{titre(item)}</div>
          {sousTitre === undefined ? null : (
            <div className="flex flex-wrap items-center gap-2 text-[0.8125rem] text-muted-foreground">
              {sousTitre(item)}
            </div>
          )}
          <NumeroAppel
            phoneE164={numero(item)}
            className="flex min-h-11 w-fit items-center text-[1rem] font-[600] underline"
          />
          {action === undefined ? null : (
            <div className="flex flex-wrap items-center gap-2">{action(item)}</div>
          )}
        </li>
      ))}
    </ul>
  );
}
