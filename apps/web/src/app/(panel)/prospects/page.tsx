import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ProspectsView } from '@/components/prospects/prospects-view';
import { PermissionDenied } from '@/components/permission-denied';
import { getServerApiClient } from '@/lib/api/server';
import { fetchProspects } from '@/lib/data/prospects';
import { fetchReferenceData } from '@/lib/data/reference';
import { parseProspectFilters, type RawSearchParams } from '@/lib/filters';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { getSession, guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Prospects' };

export default async function ProspectsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  // `GET /prospects` et les agrégats sont fermés à un BANQUE_FINANCE : son
  // métier tient dans les dossiers bancaires. On coupe ici plutôt que de
  // laisser l'écran se monter et empiler des refus de droits.
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Le suivi des prospects" />;
  }

  // Les filtres sont lus dans l'URL, côté serveur : la première page rendue est
  // déjà la page filtrée. Un lien partagé s'ouvre directement sur le bon écran,
  // sans passer par un état vide.
  const filters = parseProspectFilters(await searchParams);
  const session = await getSession();
  const client = getServerApiClient();

  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.prospects(filters),
      queryFn: () => fetchProspects(filters, client),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.reference,
      queryFn: () => fetchReferenceData(client),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {/* La fusion et la réaffectation sont des opérations d'administration :
          l'API les refuse à un COMMERCIAL, l'écran ne les propose donc pas. */}
      <ProspectsView canAdminister={session?.role === 'ADMIN'} />
    </HydrationBoundary>
  );
}
