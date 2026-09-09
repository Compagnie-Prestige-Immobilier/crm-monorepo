import { createFileRoute } from '@tanstack/react-router';

import { InboxView } from '@/components/notifications/inbox-view';
import { guardRoles } from '@/lib/guard';
import { INBOX_ROLES } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/notifications')({
  beforeLoad: guardRoles(INBOX_ROLES),
  component: InboxView,
});
