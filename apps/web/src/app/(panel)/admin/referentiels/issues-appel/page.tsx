import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PermissionDenied } from '@/components/permission-denied';
import { CallOutcomeReasonsView } from '@/components/referentiels/call-outcome-reasons-view';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Issues d’appel' };

export default async function IssuesAppelPage() {
  const guard = await guardRoles(['ADMIN', 'SUPERVISEUR', 'DIRECTION']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Le référentiel des issues d’appel" />;
  }

  return <CallOutcomeReasonsView />;
}
