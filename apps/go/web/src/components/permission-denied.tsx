import { Link } from '@tanstack/react-router';
import { LockIcon } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { homePathForRole, lien } from '@/lib/nav';
import { ROLE_LABELS, type Role } from '@/lib/types';
import { cn } from '@/lib/utils';

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
      {/* Un lien habillé en bouton : `Button` poserait `role="button"` sur le `<a>`. */}
      <Link
        {...lien(homePathForRole(role))}
        className={cn(buttonVariants({ variant: 'outline' }), 'mt-1')}
      >
        Retour à l’accueil
      </Link>
    </Card>
  );
}
