import { TrashIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ClePurge, DomainePurge } from '@/lib/data/admin';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

function ChoixDomaines({
  domaines,
  choisis,
  etendus,
  desactive,
  onBasculer,
}: {
  domaines: readonly DomainePurge[];
  choisis: readonly ClePurge[];
  etendus: readonly ClePurge[];
  desactive: boolean;
  onBasculer: (cle: ClePurge, coche: boolean) => void;
}) {
  return (
    <fieldset className="grid gap-2 sm:grid-cols-2">
      <legend className="sr-only">Domaines à supprimer</legend>
      {domaines.map((domaine) => {
        const coche = choisis.includes(domaine.key);
        const entraine = !coche && etendus.includes(domaine.key);
        return (
          <label
            key={domaine.key}
            className={cn(
              'flex min-h-11 cursor-pointer items-start gap-3 rounded-md border p-3 text-[0.875rem] transition-colors',
              'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring',
              coche || entraine ? 'border-destructive/40 bg-destructive-surface' : 'border-border',
            )}
          >
            <input
              type="checkbox"
              checked={coche || entraine}
              disabled={desactive}
              className="mt-0.5 size-4 shrink-0 accent-[var(--destructive)]"
              onChange={(event) => {
                onBasculer(domaine.key, event.target.checked);
              }}
            />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-[600]">{domaine.label}</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatNumber(domaine.rows)}
                </span>
              </span>
              <span className="mt-0.5 block text-[0.75rem] text-muted-foreground">
                {domaine.hint}
              </span>
              {entraine ? (
                <span className="mt-1 block text-[0.75rem] text-destructive">
                  Entraîné par un autre domaine sélectionné.
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

export function SelectionPurge({
  domaines,
  choisis,
  etendus,
  entraines,
  lignes,
  enCours,
  onChoisis,
  onDemander,
}: {
  domaines: readonly DomainePurge[];
  choisis: readonly ClePurge[];
  etendus: readonly ClePurge[];
  entraines: readonly ClePurge[];
  lignes: number;
  enCours: boolean;
  onChoisis: (majour: (courant: ClePurge[]) => ClePurge[]) => void;
  onDemander: () => void;
}) {
  const toutChoisi = choisis.length === domaines.length && domaines.length > 0;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[0.8125rem] text-muted-foreground">
          {choisis.length === 0
            ? 'Aucun domaine sélectionné.'
            : `${formatNumber(lignes)} lignes concernées.`}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            onChoisis(() => (toutChoisi ? [] : domaines.map((domaine) => domaine.key)));
          }}
        >
          {toutChoisi ? 'Tout désélectionner' : 'Tout sélectionner'}
        </Button>
      </div>

      <ChoixDomaines
        domaines={domaines}
        choisis={choisis}
        etendus={etendus}
        desactive={enCours}
        onBasculer={(cle, coche) => {
          onChoisis((courant) =>
            coche ? [...new Set([...courant, cle])] : courant.filter((entree) => entree !== cle),
          );
        }}
      />

      {entraines.length > 0 ? (
        <p
          role="status"
          className="rounded-md border border-destructive/30 bg-destructive-surface px-3 py-2.5 text-[0.8125rem] text-destructive"
        >
          <span className="font-[600]">Domaines entraînés :</span>{' '}
          {entraines
            .map((cle) => domaines.find((domaine) => domaine.key === cle)?.label ?? String(cle))
            .join(', ')}
          .
        </p>
      ) : null}

      <Button
        type="button"
        variant="destructive"
        className="self-start"
        disabled={choisis.length === 0 || enCours}
        onClick={onDemander}
      >
        <TrashIcon aria-hidden="true" />
        Supprimer la sélection
      </Button>
    </>
  );
}
