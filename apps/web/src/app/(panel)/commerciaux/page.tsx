import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { CommerciauxView } from '@/components/commerciaux/commerciaux-view';
import { PermissionDenied } from '@/components/permission-denied';
import { getServerApiClient } from '@/lib/api/server';
import { fetchReferenceData } from '@/lib/data/reference';
import { fetchUsers } from '@/lib/data/users';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { guardRoles } from '@/lib/session';
import { parseUserFilters, type RawSearchParams } from '@/lib/user-filters';

export const metadata: Metadata = { title: 'Téléconseillers' };

/**
 * Comptes de connexion. ADMIN seul : `GET /users` répond 403 aux autres.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Un refus de droits n'est pas un état vide.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Cet écran rendait un `EmptyState` « Accès réservé aux administrateurs ». Trois
 * défauts, tous les trois portés par les quatorze autres pages gardées du panel
 * et par `PermissionDenied` :
 *
 *  1. Le rôle en cours n'était pas nommé : l'utilisateur ne pouvait pas savoir
 *     quoi demander à son administrateur ;
 *  2. Aucune sortie n'était proposée : l'écran était un cul-de-sac ;
 *  3. Une session ABSENTE et un rôle insuffisant étaient confondus : un
 *     utilisateur déconnecté voyait « réservé aux administrateurs » au lieu
 *     d'être renvoyé se connecter.
 *
 * `guardRoles` distingue les trois issues, et `PermissionDenied` les rend.
 */
export default async function CommerciauxPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="La gestion des comptes" />;
  }

  // Filtres lus dans l'URL côté serveur : un lien partagé s'ouvre directement
  // sur la bonne liste, sans état vide intermédiaire.
  const filters = parseUserFilters(await searchParams);
  const client = getServerApiClient();
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.commerciaux(filters),
      queryFn: () => fetchUsers(filters, client),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.reference,
      queryFn: () => fetchReferenceData(client),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CommerciauxView currentUserId={guard.user.id} />
    </HydrationBoundary>
  );
}
