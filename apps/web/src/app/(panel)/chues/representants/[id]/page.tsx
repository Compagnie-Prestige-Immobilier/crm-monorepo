import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect, unstable_rethrow } from 'next/navigation';

import { PermissionDenied } from '@/components/permission-denied';
import { RepresentantDetailView } from '@/components/representants/representant-detail-view';
import { getServerApiClient } from '@/lib/api/server';
import { fetchRepresentant } from '@/lib/data/representants';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { guardRoles } from '@/lib/session';
import { readsOnly } from '@/lib/types';

export const metadata: Metadata = { title: 'Représentant' };

export default async function RepresentantPage({ params }: { params: Promise<{ id: string }> }) {
  const guard = await guardRoles([
    'ADMIN',
    'COMMERCIAL',
    'CHARGE_CLIENTELE',
    'SUPERVISEUR',
    'DIRECTION',
  ]);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="La fiche d’un représentant" />;
  }

  const { id } = await params;
  const queryClient = getQueryClient();

  try {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.representant(id),
      queryFn: () => fetchRepresentant(id, getServerApiClient()),
    });
  } catch (error) {
    unstable_rethrow(error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RepresentantDetailView
        representantId={id}
        author={{ id: guard.user.id, fullName: guard.user.fullName }}
        canAdminister={guard.user.role === 'ADMIN'}
        readOnly={readsOnly(guard.user.role)}
      />
    </HydrationBoundary>
  );
}
