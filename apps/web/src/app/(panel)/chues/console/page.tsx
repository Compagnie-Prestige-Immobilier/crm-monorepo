import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ConsoleView } from '@/components/console/console-view';
import { PermissionDenied } from '@/components/permission-denied';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Convertir un prospect' };

/** Étape 3 du projet CHUES : obtenir l'adhésion, prospect par prospect. */
export default async function ConsolePage() {
  const guard = await guardRoles([
    'ADMIN',
    'COMMERCIAL',
    'CHARGE_CLIENTELE',
    'SUPERVISEUR',
    'DIRECTION',
  ]);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return (
      <PermissionDenied role={guard.user.role} what="La consignation des appels aux prospects" />
    );
  }

  return <ConsoleView projet="CHUES" />;
}
