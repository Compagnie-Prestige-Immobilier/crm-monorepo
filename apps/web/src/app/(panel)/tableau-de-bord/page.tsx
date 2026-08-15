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

export const metadata: Metadata = { title: 'Tableau de bord' };

export default async function TableauDeBordPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  // Les agrégats de prospection sont fermés à un BANQUE_FINANCE : son tableau
  // de bord à lui est `/banque`. On l'aiguille par un refus explicite plutôt
  // que par une redirection, qui se lirait comme un lien mort.
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Le tableau de bord des prospects" />;
  }

  const filters = parseProspectFilters(await searchParams);

  // Le client SERVEUR est passé explicitement : il porte le jeton lu dans le
  // cookie `httpOnly`, que le client navigateur ne peut pas voir. Sans cet
  // argument, `src/lib/data/*` retomberait sur le client navigateur, dont
  // l'URL de base est relative : donc invalide côté serveur.
  const client = getServerApiClient();

  // QueryClient dédié à CETTE requête (voir lib/query-client.ts). Le préchargement
  // évite l'aller-retour vide → squelette → données au premier affichage.
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
