import { createFileRoute } from '@tanstack/react-router';

import { PageDemande } from '@/components/demande/page-demande';

/** Hors coque et sans session : le seul écran du panneau ouvert au public. */
export const Route = createFileRoute('/demande/$jeton')({
  component: Demande,
});

function Demande() {
  const { jeton } = Route.useParams();
  return <PageDemande jeton={jeton} />;
}
