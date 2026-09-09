import { createFileRoute } from '@tanstack/react-router';
import { z } from '@/lib/zod';

import { ConsoleAnnuaire } from '@/components/chues/console-annuaire';
import { guardProjet } from '@/lib/guard';
import { APPELANTS, SAISIE_GRAND_PUBLIC } from '@/lib/roles';

/** `?fiche=` vient des rappels : une adresse forgée ne doit pas casser l'écran. */
const recherche = z.object({ fiche: z.uuid().optional() });

export const Route = createFileRoute('/_panneau/$projet/console')({
  validateSearch: recherche,
  beforeLoad: guardProjet({ chues: APPELANTS, 'grand-public': SAISIE_GRAND_PUBLIC }),
  component: Console,
});

function Console() {
  const { projet } = Route.useRouteContext();
  const { fiche } = Route.useSearch();
  return <ConsoleAnnuaire projet={projet} fiche={fiche ?? null} />;
}
