import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ConsoleView } from '@/components/console/console-view';
import { PermissionDenied } from '@/components/permission-denied';
import { getServerApiClient } from '@/lib/api/server';
import { consoleKeys, fetchConsoleQueue } from '@/lib/data/console';
import { getQueryClient } from '@/lib/query-client';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Convertir un prospect' };

/** Étape 3 du projet CHUES : obtenir l'adhésion, prospect par prospect. */
export default async function ConsolePage() {
  const guard = await guardRoles(['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="La file d’appel des prospects" />;
  }

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: [...consoleKeys.queue(null), 'CHUES'],
    queryFn: () => fetchConsoleQueue(null, getServerApiClient(), 'CHUES'),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ConsoleView />
    </HydrationBoundary>
  );
}
