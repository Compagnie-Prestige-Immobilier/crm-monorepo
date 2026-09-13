'use client';

import { Button } from '@/components/ui/button';
import { ORIGINES_FICHE, ORIGINE_FICHE_LABELS, type OrigineFiche } from '@/lib/data/grand-public';

/**
 * Trois choix, tous visibles : le téléconseiller désigne d'où viennent les
 * fiches qu'il regarde. La liste et l'écran d'appel portent le MÊME filtre,
 * sinon l'un promet ce que l'autre ne rend pas.
 */
export function FiltreOrigine({
  value,
  onChange,
}: {
  value: OrigineFiche;
  onChange: (value: OrigineFiche) => void;
}) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-1.5">
      <legend className="mb-1.5 text-[0.8125rem] font-[600] text-foreground">Provenance</legend>
      <div className="flex flex-wrap gap-2">
        {ORIGINES_FICHE.map((origine) => (
          <Button
            key={origine}
            type="button"
            variant={value === origine ? 'default' : 'outline'}
            aria-pressed={value === origine}
            onClick={() => {
              onChange(origine);
            }}
          >
            {ORIGINE_FICHE_LABELS[origine]}
          </Button>
        ))}
      </div>
    </fieldset>
  );
}
