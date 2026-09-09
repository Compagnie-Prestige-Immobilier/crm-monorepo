import { createFileRoute } from '@tanstack/react-router';

import { NotificationsAdminView } from '@/components/notifications/notifications-admin-view';
import { guardRoles } from '@/lib/guard';
import { ADMIN_SEUL } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/admin/notifications')({
  validateSearch: (search: Record<string, unknown>): { onglet?: 'reception' } =>
    search.onglet === 'reception' ? { onglet: 'reception' } : {},
  beforeLoad: guardRoles(ADMIN_SEUL),
  component: NotificationsAdminPage,
});

function NotificationsAdminPage() {
  const { onglet } = Route.useSearch();
  return <NotificationsAdminView onglet={onglet ?? 'envoi'} />;
}
