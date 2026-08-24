import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { RegistreImportView } from '@/components/accueil/registre-import-view';
import { PermissionDenied } from '@/components/permission-denied';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Import du registre des visites' };

export default async function RegistreImportPage() {
  const guard = await guardRoles(['ADMIN', 'DIRECTION']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="L’import du registre des visites" />;
  }

  return <RegistreImportView />;
}
