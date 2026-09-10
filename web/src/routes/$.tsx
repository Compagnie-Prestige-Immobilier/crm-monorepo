import { createFileRoute, notFound, redirect } from '@tanstack/react-router';

import { movedTarget } from '@/lib/moved-routes';

/**
 * Adresses d'avant le découpage en coques (`[ancien]/[[...segments]]` en v1) :
 * la racine dit la nouvelle coque, le reste du chemin et la requête suivent.
 */
export const Route = createFileRoute('/$')({
  beforeLoad: ({ params, location }) => {
    const [root = '', ...segments] = (params._splat ?? '').split('/').filter((s) => s !== '');
    const cible = movedTarget(
      root,
      segments,
      Object.fromEntries(new URLSearchParams(location.searchStr)),
    );
    if (cible === null) throw notFound();
    throw redirect({ href: cible });
  },
});
