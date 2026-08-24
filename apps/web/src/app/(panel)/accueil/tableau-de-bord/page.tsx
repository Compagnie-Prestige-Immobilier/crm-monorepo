import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { DashboardVisitesView } from '@/components/accueil/tableau-de-bord/vue';
import { plageDuPreset } from '@/components/accueil/tableau-de-bord/periode';
import { PermissionDenied } from '@/components/permission-denied';
import { getServerApiClient } from '@/lib/api/server';
import { fetchDisposition, fetchVisiteDashboardStats } from '@/lib/data/visites-dashboard';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Tableau de bord des visites' };

export default async function TableauDeBordVisitesPage() {
  const guard = await guardRoles(['ADMIN', 'DIRECTION', 'ACCUEIL']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Le tableau de bord des visites" />;
  }

  const client = getServerApiClient();
  const plage = plageDuPreset('ce-mois', new Date());

  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.visitesStats(plage.du, plage.au),
      queryFn: () => fetchVisiteDashboardStats(plage.du, plage.au, client),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.visitesDisposition,
      queryFn: () => fetchDisposition(client),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardVisitesView role={guard.user.role} />
    </HydrationBoundary>
  );
}
