import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { PermissionDenied } from '@/components/permission-denied';
import { StatisticsView } from '@/components/stats/statistics-view';
import { StatChartsSkeleton, StatTilesSkeleton } from '@/components/stats/stat-tile';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Chiffres' };

export default async function StatistiquesPage() {
  const guard = await guardRoles(['ADMIN', 'SUPERVISEUR', 'DIRECTION']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Les statistiques" />;
  }

  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <StatTilesSkeleton />
          <StatChartsSkeleton />
        </div>
      }
    >
      <StatisticsView />
    </Suspense>
  );
}
