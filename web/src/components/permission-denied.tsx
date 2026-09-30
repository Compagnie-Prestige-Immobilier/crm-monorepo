import { LockIcon } from 'lucide-react';
import Link from 'next/link';

import { buttonVariants } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { homePath } from '@/components/layout/nav-items';
import type { SessionUser } from '@/lib/types';
import { cn } from '@/lib/utils';

export function PermissionDenied({
  user,
  what = 'Cet écran',
}: {
  user: SessionUser;
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
        {what} demande une permission que ce compte n’a pas. Un administrateur peut l’accorder dans
        Utilisateurs et rôles.
      </p>
      {/* Un LIEN habillé en bouton : la primitive `Button` de Base UI poserait
          `role="button"` sur le `<a>` et lui retirerait sa sémantique de lien. */}
      <Link href={homePath(user)} className={cn(buttonVariants({ variant: 'outline' }), 'mt-1')}>
        Retour à l’accueil
      </Link>
    </Card>
  );
}
