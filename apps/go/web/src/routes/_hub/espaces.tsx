import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';

import { EspacesGrid } from '@/components/espaces/espaces-grid';
import { cheminInterne } from '@/lib/nav';

export const Route = createFileRoute('/_hub/espaces')({
  validateSearch: (search: Record<string, unknown>): { retour?: string } => {
    const retour = cheminInterne(search.retour);
    return retour === undefined || retour.startsWith('/espaces') ? {} : { retour };
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
