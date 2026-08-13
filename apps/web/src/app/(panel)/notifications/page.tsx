import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { NotificationsView } from '@/components/notifications/notifications-view';
import { PermissionDenied } from '@/components/permission-denied';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Notifications' };

/**
 * Composition et historique des notifications push.
 *
 * Le garde est posé ICI et pas seulement dans la navigation : `nav-items.ts`
 * décide de ce qui est PROPOSÉ, la page décide de ce qui est SERVI. Une entrée
 * de menu masquée n'empêche personne de taper l'URL.
 *
 * Pas de préchargement `prefetchQuery` comme sur les autres écrans : les routes
 * de notification ne figurent pas encore dans le client généré, donc la vue les
 * charge côté navigateur à travers le relais. À rétablir en même temps que le
 * client typé.
 */
export default async function NotificationsPage() {
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="La composition des notifications" />;
  }

  return <NotificationsView />;
}
