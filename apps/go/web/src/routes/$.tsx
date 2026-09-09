import { createFileRoute, notFound, redirect } from '@tanstack/react-router';

import { movedTarget } from '@/lib/moved-routes';

/**
 * Adresses d'avant le découpage en coques. Le 301 viendra du serveur Go ; ce
 * renvoi couvre la navigation interne et les liens ouverts dans l'onglet.
 */
export const Route = createFileRoute('/$')({
  beforeLoad: ({ params, location }) => {
    const cible = movedTarget(params._splat?.split('/') ?? [], location.searchStr);
    if (cible === null) throw notFound();
    throw redirect({ href: cible });
  },
});
