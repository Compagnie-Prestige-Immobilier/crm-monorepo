import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_panneau/grand-public/tableau-de-bord')({
  beforeLoad: () => {
    throw redirect({ href: '/grand-public/statistiques' });
  },
  component: TableauDeBordGrandPublicPage,
});

/** La page `(panel)/grand-public/tableau-de-bord` de la v1, fusionnée avec « Chiffres ». */
function TableauDeBordGrandPublicPage(): null {
  return null;
}
