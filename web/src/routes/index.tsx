import { createFileRoute, redirect } from '@tanstack/react-router';

import { meQueryOptions } from '@/api/auth';
import { homePathForRole } from '@/lib/nav';

export const Route = createFileRoute('/')({
  beforeLoad: async ({ context, location }) => {
    const user = await context.queryClient.ensureQueryData(meQueryOptions);
    if (user === null) throw redirect({ to: '/connexion', search: { next: location.href } });
    throw redirect({ href: homePathForRole(user.role) });
  },
});
