import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PermissionDenied } from '@/components/permission-denied';
import { StatutsQualificationView } from '@/components/referentiels/statuts-qualification-view';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Statuts de qualification' };

export default async function StatutsQualificationPage() {
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Les statuts de qualification" />;
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-h2 font-[700] tracking-[-0.02em]">
        Statuts de qualification
      </h1>
      <StatutsQualificationView />
    </div>
  );
}
