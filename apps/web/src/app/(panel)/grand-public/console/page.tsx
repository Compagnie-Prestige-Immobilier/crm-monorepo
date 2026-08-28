import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ConsoleView } from '@/components/console/console-view';
import { PermissionDenied } from '@/components/permission-denied';
import { getServerApiClient } from '@/lib/api/server';
import { consoleKeys, fetchConsoleQueue } from '@/lib/data/console';
import { getQueryClient } from '@/lib/query-client';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Appeler les prospects' };

/**
 * La même console, sur la file GRAND PUBLIC : `ConsoleView` lit le projet dans
 * l'URL. L'écran réexportait celui de CHUES, dont le préchargement portait la
 * file CHUES et n'a jamais servi ici.
 */
export default async function GrandPublicConsolePage() {
  const guard = await guardRoles(['ADMIN', 'COMMERCIAL']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="La file d’appel Grand Public" />;
  }

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: [...consoleKeys.queue(null), 'GRAND_PUBLIC'],
    queryFn: () => fetchConsoleQueue(null, getServerApiClient(), 'GRAND_PUBLIC'),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ConsoleView />
    </HydrationBoundary>
  );
}
