import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PermissionDenied } from '@/components/permission-denied';
import { RepresentantsImportView } from '@/components/representants/representants-import-view';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Import de représentants' };

export default async function RepresentantsImportPage() {
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="L’import de représentants" />;
  }

  return <RepresentantsImportView />;
}
