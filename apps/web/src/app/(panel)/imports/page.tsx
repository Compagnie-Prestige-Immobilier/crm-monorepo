import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ImportsView } from '@/components/imports/imports-view';
import { PermissionDenied } from '@/components/permission-denied';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Imports' };

export default async function ImportsPage() {
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Les imports de masse" />;
  }

  return <ImportsView />;
}
