import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ActivityView } from '@/components/supervision/activity-view';
import { PermissionDenied } from '@/components/permission-denied';
import { OngletsPilotage } from '@/components/pilotage/onglets';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Supervision Grand Public' };

/**
 * Pas d'onglet « Présence » ici : la présence en direct des comptes ne connaît
 * aucun projet, et la coque CHUES la montre déjà.
 */
export default async function SupervisionGrandPublicPage() {
  const guard = await guardRoles(['ADMIN', 'SUPERVISEUR', 'DIRECTION']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="La supervision du Grand Public" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <OngletsPilotage coque="grand-public" />
      <ActivityView projet="GRAND_PUBLIC" />
    </div>
  );
}
