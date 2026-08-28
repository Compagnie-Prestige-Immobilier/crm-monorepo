import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ChiffresView } from '@/components/chiffres/vue';
import { PermissionDenied } from '@/components/permission-denied';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Tableau de bord Grand Public' };

export default async function ChiffresGrandPublicPage() {
  const guard = await guardRoles(['ADMIN', 'SUPERVISEUR', 'DIRECTION']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Les chiffres du projet Grand Public" />;
  }

  return <ChiffresView ecran="grand-public" role={guard.user.role} />;
}
