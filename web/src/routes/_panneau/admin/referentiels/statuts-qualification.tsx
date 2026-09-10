import { createFileRoute, redirect } from '@tanstack/react-router';

/** Les statuts sont un onglet des listes de référence ; la route survit parce qu'elle a été partagée. */
export const Route = createFileRoute('/_panneau/admin/referentiels/statuts-qualification')({
  beforeLoad: () => {
    throw redirect({ href: '/admin/referentiels?onglet=statutsQualification', replace: true });
  },
});
