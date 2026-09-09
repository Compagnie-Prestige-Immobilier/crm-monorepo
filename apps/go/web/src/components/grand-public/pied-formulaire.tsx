import { LoaderIcon } from 'lucide-react';

import type { EtatFiche } from '@/components/grand-public/corps-prospect';
import { Button } from '@/components/ui/button';
import { PROSPECT_TYPES, PROSPECT_TYPE_LABELS } from '@/lib/data/grand-public';

export function ChoixSituation({
  valeur,
  onChange,
}: {
  valeur: EtatFiche['type'];
  onChange: (suivant: EtatFiche['type']) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-[0.875rem] font-[600] text-foreground">Situation</legend>
      <div className="flex flex-wrap gap-2">
        {PROSPECT_TYPES.map((option) => {
          const actif = valeur === option;
          return (
            <Button
              key={option}
              type="button"
              size="lg"
              variant={actif ? 'default' : 'outline'}
              aria-pressed={actif}
              onClick={() => {
                onChange(actif ? null : option);
              }}
            >
              {PROSPECT_TYPE_LABELS[option]}
            </Button>
          );
        })}
      </div>
    </fieldset>
  );
}

const libelleEnvoi = (modification: boolean): string =>
  modification ? 'Enregistrer les modifications' : 'Enregistrer et suivant';

export function PiedFormulaire({
  modification,
  enregistres,
  enCours,
  onOuvrirLaFiche,
}: {
  modification: boolean;
  enregistres: readonly string[];
  enCours: boolean;
  onOuvrirLaFiche: () => void;
}) {
  const dernier = enregistres.at(-1);
  const pluriel = enregistres.length > 1 ? 's' : '';

  return (
    <div className="flex flex-wrap items-center justify-end gap-3">
      {modification ? null : (
        <>
          <p aria-live="polite" className="mr-auto text-[0.8125rem] text-muted-foreground">
            {dernier === undefined
              ? 'Ctrl + Entrée enregistre et enchaîne. Le canal et la durée restent en place.'
              : `${String(enregistres.length)} prospect${pluriel} enregistré${pluriel}. Dernier : ${dernier}.`}
          </p>
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={enCours}
            onClick={onOuvrirLaFiche}
          >
            Enregistrer et ouvrir la fiche
          </Button>
        </>
      )}
      <Button type="submit" size="lg" disabled={enCours}>
        {enCours ? (
          <>
            <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
            Enregistrement…
          </>
        ) : (
          libelleEnvoi(modification)
        )}
      </Button>
    </div>
  );
}
