import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';

import { PermissionDenied } from '@/components/permission-denied';
import { StatisticsView } from '@/components/stats/statistics-view';
import { StatChartsSkeleton, StatTilesSkeleton } from '@/components/stats/stat-tile';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Statistiques Grand Public' };

export default async function StatistiquesGrandPublicPage() {
  const guard = await guardRoles(['ADMIN', 'SUPERVISEUR', 'DIRECTION']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Les statistiques Grand Public" />;
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
      {/* Sans volet Banques : `GET /api/v1/bank-cases/analytics` n'accepte aucun
          filtre de projet, et l'onglet affichait les encaissements CHUES sous
          l'étiquette Grand Public. */}
      <StatisticsView showBanks={false} />
    </Suspense>
  );
}
