import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_panneau/chues/tableau-de-bord')({
  beforeLoad: () => {
    throw redirect({ href: '/chues/statistiques' });
  },
});
