import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { RepScript } from '@/components/console/rep-script';
import { PermissionDenied } from '@/components/permission-denied';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Qualifier un représentant' };

/** Étape 1 du projet CHUES : obtenir d'un enseignant les contacts de ses collègues. */
export default async function AppelsRepresentantsPage() {
  const guard = await guardRoles(['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Les appels aux représentants" />;
  }

  return <RepScript />;
}
