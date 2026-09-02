import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { MesContactsView } from '@/components/contacts/mes-contacts-view';
import { PermissionDenied } from '@/components/permission-denied';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Mes contacts' };

export default async function MesContactsChuesPage() {
  const guard = await guardRoles(['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Les personnes appelées" />;
  }

  return (
    <MesContactsView
      projet="CHUES"
      userId={guard.user.id}
      canFilter={guard.user.role !== 'COMMERCIAL'}
    />
  );
}
