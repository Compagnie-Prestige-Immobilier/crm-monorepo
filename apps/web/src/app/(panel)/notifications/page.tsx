import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { INBOX_ROLES } from '@/components/layout/nav-items';
import { NotificationsView } from '@/components/notifications/notifications-view';
import { PermissionDenied } from '@/components/permission-denied';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Notifications' };

export default async function BoiteDeReceptionPage() {
  const guard = await guardRoles(INBOX_ROLES);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Les notifications" />;
  }

  // L'ADMIN lit la même boîte depuis le composeur, qui lui offre en plus
  // l'historique et les gabarits. Deux écrans pour une boîte, non.
  if (guard.user.role === 'ADMIN') redirect('/admin/notifications?onglet=reception');

  return <NotificationsView isAdmin={false} />;
}
