import { HydrationBoundary, dehydrate } from '@tanstack/react-query';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

import { NON_QUALIFIES, SANS_PROSPECT, hubKeys } from '@/components/chues/hub-filters';
import { HubView } from '@/components/chues/hub-view';
import { LienFormulairePublic } from '@/components/chues/lien-formulaire-public';
import { PermissionDenied } from '@/components/permission-denied';
import { getServerApiClient } from '@/lib/api/server';
import { callbackKeys, fetchCallbacks } from '@/lib/data/console';
import { countPendingProspects } from '@/lib/data/phase2';
import { fetchRepresentants } from '@/lib/data/representants';
import { getQueryClient } from '@/lib/query-client';
import { queryKeys } from '@/lib/query-keys';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Projet CHUES' };

/**
 * La racine de la coque CHUES portait une redirection ; elle porte désormais
 * l'écran qui explique le projet. L'agent bancaire n'y a rien à lire : son
 * travail commence là où celui-ci finit.
 */
export default async function ProjetChuesPage() {
  const guard = await guardRoles([
    'ADMIN',
    'COMMERCIAL',
    'CHARGE_CLIENTELE',
    'SUPERVISEUR',
    'DIRECTION',
    'BANQUE_FINANCE',
  ]);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Le projet CHUES" />;
  }
  if (guard.user.role === 'BANQUE_FINANCE') redirect('/chues/banque');

  // Le lien se partage hors du panel : il lui faut une adresse absolue, et
  // seule la requête sait sous quel nom le panel a été atteint.
  const entetes = await headers();
  const hote = entetes.get('host') ?? '';
  const protocole = entetes.get('x-forwarded-proto') ?? 'https';

  const client = getServerApiClient();
  const queryClient = getQueryClient();
  // La portée des trois chiffres est celle du rôle : l'API borne déjà chaque
  // liste au périmètre de qui la demande.
  await Promise.all([
    queryClient.prefetchQuery({
      queryKey: queryKeys.representants(NON_QUALIFIES),
      queryFn: () => fetchRepresentants(NON_QUALIFIES, client),
    }),
    queryClient.prefetchQuery({
      queryKey: queryKeys.representants(SANS_PROSPECT),
      queryFn: () => fetchRepresentants(SANS_PROSPECT, client),
    }),
    queryClient.prefetchQuery({
      queryKey: hubKeys.prospectsEnAttente,
      queryFn: () => countPendingProspects('ALL', 'CHUES', client),
    }),
    queryClient.prefetchQuery({
      queryKey: [...callbackKeys.list('today', null), 'CHUES'],
      queryFn: () => fetchCallbacks('today', null, client, 'CHUES'),
    }),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <div className="flex flex-col gap-6">
        <HubView prenom={guard.user.fullName.split(' ')[0] ?? guard.user.fullName} />
        <LienFormulairePublic lien={`${protocole}://${hote}/demande/${guard.user.id}`} />
      </div>
    </HydrationBoundary>
  );
}
