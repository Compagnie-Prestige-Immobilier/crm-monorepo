import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { PermissionDenied } from '@/components/permission-denied';
import { ReferentielsView } from '@/components/referentiels/referentiels-view';
import { getServerApiClient } from '@/lib/api/server';
import { fetchBanques, fetchDepartements, fetchSyndicats } from '@/lib/data/reference';
import { fetchReferentielUsage } from '@/lib/data/referentiels';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Référentiels' };

/**
 * Référentiels. ADMIN seul : les écritures le sont côté API, et ouvrir l'écran
 * en lecture aux autres rôles montrerait des boutons qui échouent.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Un refus de droits n'est pas un état vide.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cet écran rendait un `EmptyState` « Accès réservé aux administrateurs » : sans
 * nommer le rôle en cours (l'utilisateur ne peut donc pas savoir quoi demander),
 * sans aucune sortie, et en confondant une session absente avec un rôle
 * insuffisant. `guardRoles` distingue les trois issues, et `PermissionDenied`
 * les rend : comme sur les quatorze autres pages gardées du panel.
 */
export default async function ReferentielsPage() {
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="La gestion des référentiels" />;
  }

  const client = getServerApiClient();
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.banques,
      queryFn: () => fetchBanques(client),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.syndicats,
      queryFn: () => fetchSyndicats(client),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.departements,
      queryFn: () => fetchDepartements(client),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.referentielUsage,
      queryFn: () => fetchReferentielUsage(client),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ReferentielsView />
    </HydrationBoundary>
  );
}
