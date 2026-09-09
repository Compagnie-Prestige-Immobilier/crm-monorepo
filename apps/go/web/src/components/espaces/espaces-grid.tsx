import { Link } from '@tanstack/react-router';
import {
  ArrowLeftIcon,
  ClipboardListIcon,
  LockIcon,
  ShieldIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cheminInterne, coqueHomePath, coquesForRole, lien, type Coque } from '@/lib/nav';
import type { Role } from '@/lib/types';
import { cn } from '@/lib/utils';

const ICONS: Record<Coque, LucideIcon> = {
  accueil: ClipboardListIcon,
  chues: UsersIcon,
  'grand-public': UsersIcon,
  admin: ShieldIcon,
};

export function EspacesGrid({ role, retour }: { role: Role; retour?: string | undefined }) {
  const espaces = coquesForRole(role);
  const cible = cheminInterne(retour);

  return (
    <div className="flex flex-col gap-6">
      {cible === undefined ? null : (
        <Link
          {...lien(cible)}
          className={cn(buttonVariants({ variant: 'ghost' }), 'self-start gap-2')}
        >
          <ArrowLeftIcon className="size-4" aria-hidden="true" />
          Revenir
        </Link>
      )}

      <div>
        <h1 className="font-display text-h1 font-[800] tracking-[-0.025em]">Vos espaces</h1>
        <p className="mt-1.5 text-body text-muted-foreground">Choisissez un espace de travail.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {espaces.map(({ entry, allowed }) => {
          const Icon = ICONS[entry.id];
          if (!allowed) {
            return (
              <Card
                key={entry.id}
                className="flex-row items-center gap-4 px-5 py-5 text-muted-foreground opacity-60"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted">
                  <LockIcon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-[700]">{entry.label}</p>
                  <p className="text-[0.8125rem]">Non accessible à votre rôle</p>
                </div>
              </Card>
            );
          }

          return (
            <Link
              key={entry.id}
              {...lien(coqueHomePath(role, entry.id))}
              className="group rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <Card className="flex-row items-center gap-4 px-5 py-5 shadow-elev-sm transition-shadow group-hover:shadow-elev-md">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-surface text-accent-text">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-[700] text-foreground">{entry.label}</p>
                  <p className="text-[0.8125rem] text-muted-foreground">{entry.description}</p>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
