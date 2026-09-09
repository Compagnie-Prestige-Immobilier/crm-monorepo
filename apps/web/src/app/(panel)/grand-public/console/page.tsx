import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ConsoleView } from '@/components/console/console-view';
import { PermissionDenied } from '@/components/permission-denied';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Appeler les prospects' };

/** Le même écran, sur les prospects GRAND PUBLIC : `ConsoleView` lit le projet. */
export default async function GrandPublicConsolePage() {
  const guard = await guardRoles(['ADMIN', 'COMMERCIAL', 'CHARGE_CLIENTELE']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return (
      <PermissionDenied role={guard.user.role} what="La consignation des appels Grand Public" />
    );
  }

  return <ConsoleView projet="GRAND_PUBLIC" />;
}
