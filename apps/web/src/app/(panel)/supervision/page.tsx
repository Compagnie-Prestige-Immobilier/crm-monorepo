import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PermissionDenied } from '@/components/permission-denied';
import { SupervisionView } from '@/components/supervision/supervision-view';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Supervision' };

export default async function SupervisionPage() {
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="La supervision des comptes" />;
  }

  return <SupervisionView />;
}
