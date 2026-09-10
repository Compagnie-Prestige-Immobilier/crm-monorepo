import { createFileRoute } from '@tanstack/react-router';
import { ArrowLeftIcon, LockIcon } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

import { COQUE_ICONS, CoqueArt } from '@/components/espaces/coque-icons';
import { coqueHomePath, coquesForRole } from '@/components/layout/nav-items';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export const Route = createFileRoute('/_hub/espaces')({
  component: EspacesPage,
  pendingComponent: Loading,
});

function Loading() {
  return (
    <div
      className="mx-auto flex max-w-5xl flex-col gap-6"
      role="status"
      aria-label="Chargement des espaces"
    >
      <Skeleton className="h-8 w-72" />
      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-40 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/** La page `(hub)/espaces` de la v1. */
function EspacesPage() {
  const { user } = Route.useRouteContext();
  const tuiles = coquesForRole(user.role);
  const requestedReturn = useSearchParams().get('retour');
  // `//evil.com` commence par « / » et est pourtant une URL absolue : le même
  // motif qu'à la connexion refuse la double barre et l'antislash.
  const returnPath =
    typeof requestedReturn === 'string' &&
    /^\/(?!\/)[^\\]*$/.test(requestedReturn) &&
    !requestedReturn.startsWith('/espaces')
      ? requestedReturn
      : null;

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-h1 font-[800]">
          {returnPath === null ? 'Choisissez un espace' : 'Changer d’espace'}
        </h1>
        {returnPath === null ? null : (
          <Button render={<Link href={returnPath} />} variant="outline">
            <ArrowLeftIcon aria-hidden="true" />
            Retour
          </Button>
        )}
      </div>

      <ul className="grid auto-rows-fr gap-5 sm:grid-cols-2">
        {tuiles.map(({ entry, allowed }, index) => {
          const Icon = COQUE_ICONS[entry.id];

          if (!allowed) {
            return (
              <li key={entry.id} className="h-full">
                <div className="animate-rise relative flex h-full min-h-[14rem] flex-col gap-3 overflow-hidden rounded-lg border border-dashed border-border bg-muted/60 p-6 text-muted-foreground">
                  <CoqueArt coque={entry.id} />
                  <span className="relative z-10 size-12 shrink-0">
                    <Icon />
                  </span>
                  <span className="relative z-10 max-w-[58%] font-display text-h3 font-[700] tracking-[-0.02em]">
                    {entry.label}
                  </span>
                  <span className="relative z-10 max-w-[58%] text-small">{entry.description}</span>
                  <span className="relative z-10 mt-auto flex items-center gap-2 text-small">
                    <LockIcon className="size-4 shrink-0" aria-hidden="true" />
                    Réservé à d’autres profils
                  </span>
                </div>
              </li>
            );
          }

          return (
            <li key={entry.id} className="h-full">
              <Link
                href={coqueHomePath(user.role, entry.id)}
                style={{ animationDelay: `${String(index * 40)}ms` }}
                className="animate-rise relative flex h-full min-h-[14rem] flex-col gap-3 overflow-hidden rounded-lg border border-border bg-card p-6 shadow-elev-sm transition-shadow duration-(--dur-2) ease-(--ease-out-cpi) hover:shadow-elev-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <CoqueArt coque={entry.id} />
                {entry.id === 'chues' ? (
                  <Image
                    src="/brand/chues-logo.webp"
                    alt=""
                    width={328}
                    height={160}
                    className="relative z-10 h-10 w-auto shrink-0 self-start object-contain"
                  />
                ) : (
                  <span className="relative z-10 size-12 shrink-0 text-primary-text">
                    <Icon />
                  </span>
                )}
                <span className="relative z-10 max-w-[58%] font-display text-h3 font-[700] tracking-[-0.02em]">
                  {entry.label}
                </span>
                <span className="relative z-10 max-w-[58%] text-small text-muted-foreground">
                  {entry.description}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
