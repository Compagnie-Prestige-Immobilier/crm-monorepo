'use client';

import { BellIcon } from 'lucide-react';

export function ApercuNotification({
  title,
  body,
  route,
}: {
  title: string;
  body: string;
  route?: string | null | undefined;
}) {
  const vide = title === '' && body === '';
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-[0.75rem] font-[600] text-muted-foreground">
        Aperçu dans la boîte de réception
      </figcaption>
      <div className="flex gap-3 rounded-[var(--radius-md)] border border-border bg-card p-3 shadow-elev-xs">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-primary"
        >
          <BellIcon className="size-4" />
        </span>
        <div className={vide ? 'min-w-0 opacity-60' : 'min-w-0'}>
          <p className="text-[0.875rem] font-[600] break-words">
            {title === '' ? 'Titre de la notification' : title}
          </p>
          <p className="mt-0.5 text-[0.8125rem] leading-[1.4] break-words text-muted-foreground">
            {body === '' ? 'Corps du message' : body}
          </p>
        </div>
      </div>
      <p className="text-[0.75rem] text-muted-foreground">
        {route === null || route === undefined || route === '' ? (
          'Sans lien : ouvre la boîte de réception.'
        ) : (
          <>
            Ouvre <code className="font-mono text-foreground">{route}</code>.
          </>
        )}
      </p>
    </figure>
  );
}
