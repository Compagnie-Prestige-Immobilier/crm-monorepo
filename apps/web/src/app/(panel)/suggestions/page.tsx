import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect, unstable_rethrow } from 'next/navigation';

import { PermissionDenied } from '@/components/permission-denied';
import { SuggestionsView } from '@/components/suggestions/suggestions-view';
import { getServerApiClient } from '@/lib/api/server';
import { fetchSuggestions, suggestionsQueryKey } from '@/lib/data/suggestions';
import { getQueryClient } from '@/lib/query-client';
import { guardRoles } from '@/lib/session';
import { readsOnly } from '@/lib/types';

export const metadata: Metadata = { title: 'Numéros suggérés' };

export default async function SuggestionsPage() {
  const guard = await guardRoles(['ADMIN', 'COMMERCIAL', 'SUPERVISEUR', 'DIRECTION']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Les numéros suggérés" />;
  }

  const queryClient = getQueryClient();

  try {
    await queryClient.prefetchQuery({
      queryKey: suggestionsQueryKey(null),
      queryFn: () => fetchSuggestions(null, getServerApiClient()),
    });
  } catch (error) {
    unstable_rethrow(error);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SuggestionsView readOnly={readsOnly(guard.user.role)} />
    </HydrationBoundary>
  );
}
