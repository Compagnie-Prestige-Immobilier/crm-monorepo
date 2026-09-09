import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { hasInbox, INBOX_PATH } from '@/components/layout/nav-items';
import { NotificationsView } from '@/components/notifications/notifications-view';
import { PermissionDenied } from '@/components/permission-denied';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Notifications' };

/**
 * Le COMPOSEUR, et rien d'autre : la route est dans la coque Admin, dont
 * aucune entrée de menu n'est ouverte aux autres rôles. Leur boîte de
 * réception est `/notifications`, hors coque.
 */
export default async function NotificationsPage() {
  const guard = await guardRoles(['ADMIN']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    if (hasInbox(guard.user.role)) redirect(INBOX_PATH);
    return <PermissionDenied role={guard.user.role} what="Les notifications envoyées" />;
  }

  return <NotificationsView isAdmin />;
}
