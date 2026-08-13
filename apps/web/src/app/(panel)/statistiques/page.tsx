import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { PermissionDenied } from '@/components/permission-denied';
import { StatisticsView } from '@/components/stats/statistics-view';
import { StatChartsSkeleton, StatTilesSkeleton } from '@/components/stats/stat-tile';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Statistiques' };

export default async function StatistiquesPage() {
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Les statistiques" />;
  }

  return (
    // `useSearchParams` impose une frontière de suspense : l'onglet courant vit
    // dans l'URL, et sans ce `Suspense` la page entière basculerait en rendu
    // dynamique au lieu du seul volet.
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
