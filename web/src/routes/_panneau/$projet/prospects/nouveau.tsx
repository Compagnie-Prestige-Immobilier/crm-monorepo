import { createFileRoute } from '@tanstack/react-router';

import { FormulaireProspect } from '@/components/prospects/formulaire';
import { guardProjet } from '@/lib/guard';
import { APPELANTS, AUCUN } from '@/lib/roles';

export const Route = createFileRoute('/_panneau/$projet/prospects/nouveau')({
  validateSearch: (search: Record<string, unknown>): { rep?: string } =>
    typeof search.rep === 'string' && search.rep !== '' ? { rep: search.rep } : {},
  beforeLoad: guardProjet({ chues: APPELANTS, 'grand-public': AUCUN }),
  component: EcranNouveauProspect,
});

function EcranNouveauProspect() {
  const { rep } = Route.useSearch();
  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <p className="text-[0.9375rem] text-muted-foreground">
        Une fiche par prospect remis. Ctrl + Entrée enchaîne : le représentant, la banque et le
        syndicat restent d’une saisie à l’autre.
      </p>
      <FormulaireProspect representantId={rep ?? null} />
    </div>
  );
}
