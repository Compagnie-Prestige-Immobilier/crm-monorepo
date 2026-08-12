import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import { ShieldAlertIcon } from 'lucide-react';
import type { Metadata } from 'next';

import { CommerciauxView } from '@/components/commerciaux/commerciaux-view';
import { EmptyState } from '@/components/empty-state';
import { getServerApiClient } from '@/lib/api/server';
import { fetchReferenceData } from '@/lib/data/reference';
import { DEFAULT_USER_FILTERS, fetchUsers } from '@/lib/data/users';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { getAdminSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Commerciaux' };

export default async function CommerciauxPage() {
  // `GET /users` répond 403 à un COMMERCIAL. On coupe ici plutôt que de laisser
  // l'écran se monter, lancer six requêtes et afficher une pile d'erreurs.
  const session = await getAdminSession();
  if (session === null) {
    return (
      <EmptyState
        icon={ShieldAlertIcon}
        title="Accès réservé aux administrateurs"
        description="La gestion des comptes commerciaux n’est accessible qu’avec un compte administrateur. Demandez à la DSI de CPI de relever vos droits si vous en avez besoin."
      />
    );
  }

  const client = getServerApiClient();
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.commerciaux(DEFAULT_USER_FILTERS),
      queryFn: () => fetchUsers(DEFAULT_USER_FILTERS, client),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.reference,
      queryFn: () => fetchReferenceData(client),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CommerciauxView currentUserId={session.id} />
    </HydrationBoundary>
  );
}
