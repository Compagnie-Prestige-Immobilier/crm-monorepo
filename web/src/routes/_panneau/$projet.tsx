import { createFileRoute, notFound, Outlet, redirect } from '@tanstack/react-router';

import { movedTarget } from '@/lib/moved-routes';
import { estProjet, PROJET_API } from '@/lib/types';

/**
 * Un seul arbre pour les deux projets. Le segment est validé ici ; les écrans
 * lisent `projet` par `Route.useParams()` et `projetApi` par le contexte.
 *
 * Les anciennes adresses (`/prospects`, `/phase2/callbacks`) tombent d'abord
 * dans cet arbre : c'est donc ici qu'elles se font renvoyer, avant le 404.
 */
export const Route = createFileRoute('/_panneau/$projet')({
  beforeLoad: ({ params, location }) => {
    if (!estProjet(params.projet)) {
      const segments = location.pathname.split('/').filter(Boolean);
      const cible = movedTarget(segments, location.searchStr);
      if (cible === null) throw notFound();
      throw redirect({ href: cible });
    }
    return { projet: params.projet, projetApi: PROJET_API[params.projet] };
  },
  component: () => <Outlet />,
});
