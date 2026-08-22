import { ArrowLeftIcon, LockIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { COQUE_ICONS, CoqueArt } from '@/app/(hub)/espaces/coque-icons';
import { coqueHomePath, coquesForRole } from '@/components/layout/nav-items';
import { Button } from '@/components/ui/button';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Espaces' };

export default async function EspacesPage({
  searchParams,
}: {
  searchParams: Promise<{ retour?: string }>;
}) {
  const user = await getSession();
  if (user === null) redirect('/connexion');

  const tuiles = coquesForRole(user.role);
  const requestedReturn = (await searchParams).retour;
  const returnPath =
    requestedReturn?.startsWith('/') === true && !requestedReturn.startsWith('/espaces')
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
                {/* Grisée et sans lien : le projet existe, il ne s'ouvre pas
                    ici. Le gris vient des tokens et non d'une `opacity`, qui
                    ferait passer le texte sous le seuil de lisibilité. */}
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
              {/* Toute la tuile est la cible : c'est la plus grande qu'on
                  puisse offrir au même endroit (Fitts). */}
              <Link
                href={coqueHomePath(user.role, entry.id)}
                style={{ animationDelay: `${String(index * 40)}ms` }}
                className="animate-rise relative flex h-full min-h-[14rem] flex-col gap-3 overflow-hidden rounded-lg border border-border bg-card p-6 shadow-elev-sm transition-shadow duration-(--dur-2) ease-(--ease-out-cpi) hover:shadow-elev-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <CoqueArt coque={entry.id} />
                <span className="relative z-10 size-12 shrink-0 text-primary-text">
                  <Icon />
                </span>
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
