import { createFileRoute } from '@tanstack/react-router';

import { SuggestionsView } from '@/components/chues/suggestions-view';
import { guardProjet } from '@/lib/guard';
import { APPELANTS, AUCUN } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/$projet/suggestions')({
  beforeLoad: guardProjet({ chues: APPELANTS, 'grand-public': AUCUN }),
  component: Suggestions,
});

function Suggestions() {
  const { projet } = Route.useRouteContext();
  return <SuggestionsView projet={projet} />;
}
