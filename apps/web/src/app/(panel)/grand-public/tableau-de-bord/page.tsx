import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { DashboardView } from '@/components/dashboard/dashboard-view';
import { PermissionDenied } from '@/components/permission-denied';
import { getServerApiClient } from '@/lib/api/server';
import { fetchReferenceData } from '@/lib/data/reference';
import { fetchDashboardStats } from '@/lib/data/stats';
import { parseProspectFilters, type RawSearchParams } from '@/lib/filters';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Tableau de bord Grand Public' };

export default async function TableauDeBordGrandPublicPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const guard = await guardRoles(['ADMIN', 'DIRECTION', 'SUPERVISEUR']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return (
      <PermissionDenied
        role={guard.user.role}
        what="Le tableau de bord des prospects Grand Public"
      />
    );
  }

  // Le projet est imposé ici comme le chemin l'impose côté client
  // (`useProspectFilters`) : sans lui, le préchargement servirait les chiffres
  // des deux projets, et la clé de cache ne serait pas celle du navigateur.
  const filters = { ...parseProspectFilters(await searchParams), projet: 'GRAND_PUBLIC' as const };

  const client = getServerApiClient();
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.dashboard(filters),
      queryFn: () => fetchDashboardStats(filters, client),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.reference,
      queryFn: () => fetchReferenceData(client),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardView />
    </HydrationBoundary>
  );
}
