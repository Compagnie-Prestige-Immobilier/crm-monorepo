import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PermissionDenied } from '@/components/permission-denied';
import { RepCampaignsView } from '@/components/phase2/rep-campaigns-view';
import { getServerApiClient } from '@/lib/api/server';
import { fetchRepCampaigns } from '@/lib/data/rep-campaigns';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { parseRepCampaignFilters, type RawSearchParams } from '@/lib/rep-campaign-filters';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Campagnes représentants' };

/**
 * Second onglet de `/campagnes`, servi par une ROUTE et non par un paramètre.
 *
 * Les deux listes sont filtrables et `useUrlFilters` réécrit la chaîne de
 * requête entière : les faire cohabiter dans une seule URL ferait qu'un « Tout
 * effacer » d'un côté emporte les critères de l'autre. Le découpage par route
 * règle le problème à la racine, et permet de ne précharger que la liste
 * réellement demandée.
 */
export default async function CampagnesRepresentantsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Le suivi des campagnes représentants" />;
  }

  const filters = parseRepCampaignFilters(await searchParams);
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.repCampaigns(filters),
    queryFn: () => fetchRepCampaigns(filters, getServerApiClient()),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RepCampaignsView />
    </HydrationBoundary>
  );
}
