import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ListesView } from '@/components/accueil/listes-view';
import { PermissionDenied } from '@/components/permission-denied';
import { getServerApiClient } from '@/lib/api/server';
import {
  fetchVisiteReferentielList,
  fetchVisiteReferentielUsage,
  VISITE_REFERENTIEL_KINDS,
} from '@/lib/data/visites-referentiels';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Listes du registre des visites' };

export default async function ListesVisitesPage() {
  const guard = await guardRoles(['ADMIN', 'DIRECTION']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="La gestion des listes du registre" />;
  }

  const client = getServerApiClient();
  const queryClient = getQueryClient();

  await Promise.all([
    ...VISITE_REFERENTIEL_KINDS.map((kind) =>
      queryClient.prefetchQuery({
        queryKey: queryKeys.visiteReferentiel(kind),
        queryFn: () => fetchVisiteReferentielList(kind, client),
      }),
    ),
    queryClient.prefetchQuery({
      queryKey: queryKeys.visiteReferentielUsage,
      queryFn: () => fetchVisiteReferentielUsage(client),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ListesView />
    </HydrationBoundary>
  );
}
