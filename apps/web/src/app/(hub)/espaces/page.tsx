import { LockIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { COQUE_ICONS } from '@/app/(hub)/espaces/coque-icons';
import { coqueHomePath, coquesForRole } from '@/components/layout/nav-items';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Espaces' };

export default async function EspacesPage() {
  const user = await getSession();
  if (user === null) redirect('/connexion');

  const tuiles = coquesForRole(user.role);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
      <h1 className="font-display text-h1 font-[800]">Choisissez un espace</h1>

      <ul className="grid gap-4 sm:grid-cols-2">
        {tuiles.map(({ entry, allowed }, index) => {
          const Icon = COQUE_ICONS[entry.id];

          if (!allowed) {
            return (
              <li key={entry.id}>
                {/* Grisée et sans lien : le projet existe, il ne s'ouvre pas
                    ici. Le gris vient des tokens et non d'une `opacity`, qui
                    ferait passer le texte sous le seuil de lisibilité. */}
                <div className="animate-rise flex min-h-[12rem] flex-col gap-3 rounded-lg border border-dashed border-border bg-muted/60 p-6 text-muted-foreground">
                  <span className="size-12 shrink-0">
                    <Icon />
                  </span>
                  <span className="font-display text-h3 font-[700] tracking-[-0.02em]">
                    {entry.label}
                  </span>
                  <span className="text-small">{entry.description}</span>
                  <span className="mt-auto flex items-center gap-2 text-small">
                    <LockIcon className="size-4 shrink-0" aria-hidden="true" />
                    Réservé à d’autres profils
                  </span>
                </div>
              </li>
            );
          }

          return (
            <li key={entry.id}>
              {/* Toute la tuile est la cible : c'est la plus grande qu'on
                  puisse offrir au même endroit (Fitts). */}
              <Link
                href={coqueHomePath(user.role, entry.id)}
                style={{ animationDelay: `${String(index * 40)}ms` }}
                className="animate-rise flex min-h-[12rem] flex-col gap-3 rounded-lg border border-border bg-card p-6 shadow-elev-sm transition-shadow duration-(--dur-2) ease-(--ease-out-cpi) hover:shadow-elev-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="size-12 shrink-0 text-primary-text">
                  <Icon />
                </span>
                <span className="font-display text-h3 font-[700] tracking-[-0.02em]">
                  {entry.label}
                </span>
                <span className="text-small text-muted-foreground">{entry.description}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
