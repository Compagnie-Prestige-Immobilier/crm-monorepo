import { createFileRoute, redirect } from '@tanstack/react-router';

import { NotificationsAdminView } from '@/components/notifications/notifications-admin-view';
import { guardRoles } from '@/lib/guard';
import { ADMIN_SEUL, INBOX_ROLES } from '@/lib/roles';

const gardeAdmin = guardRoles(ADMIN_SEUL);

export const Route = createFileRoute('/_panneau/admin/notifications')({
  validateSearch: (search: Record<string, unknown>): { onglet?: 'reception' } =>
    search.onglet === 'reception' ? { onglet: 'reception' } : {},
  // Des notifications déjà envoyées pointent ici : un rôle à boîte retrouve la sienne.
  beforeLoad: (options) => {
    const { role } = options.context.user;
    if (role !== 'ADMIN' && INBOX_ROLES.includes(role)) throw redirect({ to: '/notifications' });
    return gardeAdmin(options);
  },
  component: NotificationsAdminPage,
});

function NotificationsAdminPage() {
  const { onglet } = Route.useSearch();
  return <NotificationsAdminView onglet={onglet ?? 'envoi'} />;
}
