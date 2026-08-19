import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { PermissionDenied } from '@/components/permission-denied';
import { buttonVariants } from '@/components/ui/button';
import { guardRoles } from '@/lib/session';

export default async function AccueilLayout({ children }: { children: ReactNode }) {
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Le registre des visites" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Visites" className="flex flex-wrap gap-2 print:hidden">
        <Link href="/accueil" className={buttonVariants({ variant: 'outline' })}>
          Registre
        </Link>
        <Link href="/accueil/tableau-de-bord" className={buttonVariants({ variant: 'outline' })}>
          Tableau de bord
        </Link>
      </nav>
      {children}
    </div>
  );
}
