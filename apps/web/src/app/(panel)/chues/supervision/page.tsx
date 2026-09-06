import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { PermissionDenied } from '@/components/permission-denied';
import { OngletsPilotage } from '@/components/pilotage/onglets';
import { SupervisionSkeleton } from '@/components/supervision/supervision-view';
import { SupervisionTabs } from '@/components/supervision/supervision-tabs';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Supervision' };

export default async function SupervisionPage() {
  const guard = await guardRoles(['ADMIN', 'SUPERVISEUR', 'DIRECTION']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="La supervision" />;
  }

  return (
    <Suspense fallback={<SupervisionSkeleton />}>
      <div className="flex flex-col gap-6">
        <OngletsPilotage coque="chues" />
        <SupervisionTabs projet="CHUES" role={guard.user.role} />
      </div>
    </Suspense>
  );
}
