import type { UseQueryResult } from '@tanstack/react-query';

import { PastilleRelation } from '@/components/chues/badges';
import { QueryErrorState } from '@/components/query-error-state';
import { Skeleton } from '@/components/ui/skeleton';
import type { PageRepresentants, Representant } from '@/lib/data/representants';
import { formatPhone } from '@/lib/format';
import { cn } from '@/lib/utils';

/** L'annuaire cherché par le SERVEUR : nom et numéro réduit à ses chiffres. */
export function Resultats({
  annuaire,
  critereEnCours,
  onOuvrir,
}: {
  annuaire: UseQueryResult<PageRepresentants>;
  critereEnCours: boolean;
  onOuvrir: (ligne: Representant) => void;
}) {
  if (annuaire.isError) {
    return (
      <QueryErrorState
        error={annuaire.error}
        fallback="L’annuaire n’a pas pu être lu."
        onRetry={() => {
          void annuaire.refetch();
        }}
      />
    );
  }

  if (annuaire.data === undefined) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
        <Skeleton className="h-14" />
      </div>
    );
  }

  if (annuaire.data.items.length === 0) {
    return (
      <p className="text-[0.9375rem]">
        {critereEnCours
          ? 'Aucun résultat parmi vos fiches. Vérifiez le nom ou le numéro, ou demandez une campagne.'
          : 'Aucune fiche ne vous est attribuée. Demandez une campagne.'}
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-2">
      {annuaire.data.items.map((ligne) => (
        <li key={ligne.id}>
          <button
            type="button"
            onClick={() => {
              onOuvrir(ligne);
            }}
            className={cn(
              'flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border border-border px-3 py-3 text-left',
              'hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            )}
          >
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[0.9375rem] font-[600]">{ligne.fullName}</span>
              <span className="text-[0.8125rem] text-muted-foreground">
                <span className="tabular-nums">{formatPhone(ligne.phoneE164)}</span>
                {ligne.departementName === '' ? '' : ` · ${ligne.departementName}`}
              </span>
            </span>
            <PastilleRelation
              status={ligne.relationStatus}
              label={ligne.statutQualificationLabel}
              effect={ligne.statutQualificationEffect}
              lastCallOutcome={ligne.lastCallOutcome}
            />
          </button>
        </li>
      ))}
    </ol>
  );
}
