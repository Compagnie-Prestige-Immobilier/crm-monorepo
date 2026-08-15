import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { RepresentantsView } from '@/components/representants/representants-view';
import { PermissionDenied } from '@/components/permission-denied';
import { getServerApiClient } from '@/lib/api/server';
import { fetchReferenceData } from '@/lib/data/reference';
import { fetchRepresentants } from '@/lib/data/representants';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { parseRepresentantFilters, type RawSearchParams } from '@/lib/representant-filters';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Représentants' };

export default async function RepresentantsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  // Les représentants relèvent de la prospection terrain : l'API les ferme à
  // un BANQUE_FINANCE. On coupe ici plutôt que de laisser l'écran se monter et
  // empiler des refus de droits.
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="La gestion des représentants" />;
  }

  // Les filtres sont lus dans l'URL, côté serveur : la première page rendue est
  // déjà la page filtrée. Un lien partagé s'ouvre directement sur le bon écran,
  // sans passer par un état vide puis un aller-retour supplémentaire.
  const filters = parseRepresentantFilters(await searchParams);
  const client = getServerApiClient();
  const queryClient = getQueryClient();

  // Préchargement serveur : la première peinture porte déjà les lignes, au lieu
  // d'un squelette suivi d'un aller-retour depuis le navigateur.
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.representants(filters),
      queryFn: () => fetchRepresentants(filters, client),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.reference,
      queryFn: () => fetchReferenceData(client),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <RepresentantsView />
    </HydrationBoundary>
  );
}
