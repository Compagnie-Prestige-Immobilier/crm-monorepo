import { LockIcon } from 'lucide-react';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { homePathForRole } from '@/components/layout/nav-items';
import { ROLE_LABELS, type Role } from '@/lib/types';
import { cn } from '@/lib/utils';

/**
 * Refus de droits : l'état qui manquait aux écrans réservés.
 *
 * Ce n'est ni une erreur ni une page introuvable, et le présenter comme telle
 * serait trompeur : la session est valide, la page existe, c'est le rôle qui ne
 * convient pas. On le dit, on nomme le rôle en cours : sans quoi l'utilisateur
 * ne peut pas savoir quoi demander à son administrateur : et on offre une
 * sortie vers un écran qui, lui, lui est ouvert.
 *
 * Surtout pas de bouton « Réessayer » : recliquer sur un refus de droits ne
 * fait que rejouer le refus.
 */
export function PermissionDenied({
  role,
  what = 'Cet écran',
}: {
  role: Role;
  what?: string | undefined;
}) {
  return (
    <Card
      role="alert"
      className="animate-rise mx-auto max-w-lg items-center gap-3 px-6 py-16 text-center"
    >
      <span
        aria-hidden="true"
        className="flex size-12 items-center justify-center rounded-full bg-destructive-surface text-destructive"
      >
        <LockIcon className="size-6" />
      </span>
      <h2 className="font-display text-[1.25rem] font-[700] tracking-[-0.02em]">Accès refusé</h2>
      <p className="max-w-md text-[0.9375rem] text-muted-foreground">
        {what} est réservé à un autre rôle. Rôle en cours :{' '}
        <strong className="font-[600] text-foreground">{ROLE_LABELS[role]}</strong>.
      </p>
      {/* Un LIEN habillé en bouton : la primitive `Button` de Base UI poserait
          `role="button"` sur le `<a>` et lui retirerait sa sémantique de lien. */}
      <Link
        href={homePathForRole(role)}
        className={cn(buttonVariants({ variant: 'outline' }), 'mt-1')}
      >
        Retour à l’accueil
      </Link>
    </Card>
  );
}
