import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { VisitesTabs } from '@/components/accueil/visites-tabs';
import { PermissionDenied } from '@/components/permission-denied';
import { guardRoles } from '@/lib/session';

export default async function AccueilLayout({ children }: { children: ReactNode }) {
  const guard = await guardRoles(['ADMIN', 'DIRECTION', 'ACCUEIL']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Le registre des visites" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <VisitesTabs role={guard.user.role} />
      {children}
    </div>
  );
}
