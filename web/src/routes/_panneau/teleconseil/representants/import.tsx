import { createFileRoute, redirect } from '@tanstack/react-router';

import { type Contexte, guardPermission } from '@/lib/guard';

export const Route = createFileRoute('/_panneau/teleconseil/representants/import')({
  beforeLoad: (contexte: Contexte) => {
    guardPermission('imports.administrer')(contexte);
    throw redirect({ href: '/admin/imports?entite=representants', replace: true });
  },
});
