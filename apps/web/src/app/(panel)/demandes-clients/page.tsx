import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ClientRequestsView } from '@/components/client-requests/client-requests-view';
import { PermissionDenied } from '@/components/permission-denied';
import { getServerApiClient } from '@/lib/api/server';
import { parseClientRequestFilters, type RawSearchParams } from '@/lib/client-request-filters';
import { fetchClientRequests } from '@/lib/data/client-requests';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Demandes clients' };

/**
 * Demandes de création de client : ARBITRAGE pour l'ADMIN, SUIVI pour la banque.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Pourquoi cet écran ne peut PAS rester réservé à l'ADMIN.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Refuser une demande notifie l'agent BANQUE_FINANCE qui l'a déposée, et cette
 * notification porte `route: '/demandes-clients'`. La cloche en fait un lien,
 * l'agent clique : et tombait sur un refus de droits, depuis une notification
 * parfaitement légitime qui lui annonçait une décision le concernant.
 *
 * L'API, elle, était déjà juste : `GET /client-requests` est ouvert au rôle
 * BANQUE_FINANCE et restreint la liste à `requestedById = user.id`. Un agent ne
 * voit donc que SES demandes, jamais celles d'une autre banque : le filtrage
 * n'est pas laissé au navigateur.
 *
 * L'écran, lui, se règle sur le rôle : l'agent LIT (statut, motif de refus,
 * prospect créé), il n'arbitre pas. Les deux boutons de décision, la recherche
 * par banque demandeuse et les compteurs d'arbitrage restent à l'ADMIN.
 */
export default async function DemandesClientsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const guard = await guardRoles(['ADMIN', 'BANQUE_FINANCE']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Le suivi des demandes de création" />;
  }

  // Filtres lus dans l'URL côté serveur : la première page rendue est déjà la
  // page filtrée, et « les demandes en attente de la CBAO » est un lien.
  const filters = parseClientRequestFilters(await searchParams);
  const queryClient = getQueryClient();
  await queryClient.prefetchQuery({
    queryKey: queryKeys.clientRequests(filters),
    queryFn: () => fetchClientRequests(filters, getServerApiClient()),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ClientRequestsView role={guard.user.role} />
    </HydrationBoundary>
  );
}
