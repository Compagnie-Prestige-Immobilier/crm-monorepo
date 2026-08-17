import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { NotificationsView } from '@/components/notifications/notifications-view';
import { PermissionDenied } from '@/components/permission-denied';
import { guardRoles } from '@/lib/session';

export const metadata: Metadata = { title: 'Notifications' };

export default async function NotificationsPage() {
  const guard = await guardRoles(['ADMIN', 'BANQUE_FINANCE', 'COMMERCIAL']);
  if (guard.status === 'anonymous') redirect('/connexion');
  if (guard.status === 'denied') {
    return <PermissionDenied role={guard.user.role} what="Les notifications" />;
  }

  return <NotificationsView isAdmin={guard.user.role === 'ADMIN'} />;
}
