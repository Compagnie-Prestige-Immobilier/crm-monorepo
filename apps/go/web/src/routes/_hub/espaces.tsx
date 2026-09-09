import { createFileRoute } from '@tanstack/react-router';

import { EspacesGrid } from '@/components/espaces/espaces-grid';

export const Route = createFileRoute('/_hub/espaces')({
  validateSearch: (search: Record<string, unknown>): { retour?: string } => {
    const retour = typeof search.retour === 'string' ? search.retour : undefined;
    return retour === undefined ? {} : { retour };
  },
  component: EspacesPage,
});

function EspacesPage() {
  const { user } = Route.useRouteContext();
  const { retour } = Route.useSearch();
  return <EspacesGrid role={user.role} retour={retour} />;
}
