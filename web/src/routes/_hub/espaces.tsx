import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';

import { EspacesGrid } from '@/components/espaces/espaces-grid';
import { cheminInterne } from '@/lib/nav';

export const Route = createFileRoute('/_hub/espaces')({
  // Le routeur fusionne la recherche brute du parent sous le résultat : la clé doit être posée.
  validateSearch: (search: Record<string, unknown>): { retour?: string | undefined } => {
    const retour = cheminInterne(search.retour);
    return { retour: retour === undefined || retour.startsWith('/espaces') ? undefined : retour };
  },
  component: EspacesPage,
});

function EspacesPage() {
  const { user } = Route.useRouteContext();
  const { retour } = Route.useSearch();
  useEffect(() => {
    document.title = 'Vos espaces · CPI GO';
  }, []);
  return <EspacesGrid role={user.role} retour={retour} />;
}
