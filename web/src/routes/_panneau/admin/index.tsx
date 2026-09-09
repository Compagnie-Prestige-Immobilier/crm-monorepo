import { createFileRoute, redirect } from '@tanstack/react-router';

import { coqueHomePath } from '@/lib/nav';

/** La racine d'une coque n'a pas d'écran à elle : elle mène au premier du rôle. */
export const Route = createFileRoute('/_panneau/admin/')({
  beforeLoad: ({ context }) => {
    throw redirect({ href: coqueHomePath(context.user.role, 'admin') });
  },
});
