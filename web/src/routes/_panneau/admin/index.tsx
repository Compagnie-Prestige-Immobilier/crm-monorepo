import { createFileRoute, redirect } from '@tanstack/react-router';

import { coqueHomePath } from '@/components/layout/nav-items';

export const Route = createFileRoute('/_panneau/admin/')({
  beforeLoad: ({ context }) => {
    throw redirect({ href: coqueHomePath(context.user.role, 'admin') });
  },
});
