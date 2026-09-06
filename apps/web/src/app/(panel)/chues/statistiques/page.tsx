import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ChiffresView } from '@/components/chiffres/vue';
import { PermissionDenied } from '@/components/permission-denied';
import { OngletsPilotage } from '@/components/pilotage/onglets';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Tableau de bord' };

export default async function ChiffresChuesPage() {
  const guard = await guardRoles(['ADMIN', 'SUPERVISEUR', 'DIRECTION']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Les chiffres du projet CHUES" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <OngletsPilotage coque="chues" />
      <ChiffresView ecran="chues" role={guard.user.role} />
    </div>
  );
}
