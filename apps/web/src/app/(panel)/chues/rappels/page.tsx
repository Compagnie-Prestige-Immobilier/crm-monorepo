import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PermissionDenied } from '@/components/permission-denied';
import { RappelsView } from '@/components/rappels/rappels-view';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Rappels' };

export default async function RappelsPage() {
  const guard = await guardRoles(['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Les rappels promis" />;
  }

  return <RappelsView canFilter={guard.user.role !== 'COMMERCIAL'} />;
}
