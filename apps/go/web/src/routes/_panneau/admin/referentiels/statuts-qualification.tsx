import { createFileRoute, redirect } from '@tanstack/react-router';

/** Les statuts sont devenus un onglet des listes de référence ; l'adresse a été partagée. */
export const Route = createFileRoute('/_panneau/admin/referentiels/statuts-qualification')({
  beforeLoad: () => {
    throw redirect({ href: '/admin/referentiels?onglet=statutsQualification' });
  },
});
