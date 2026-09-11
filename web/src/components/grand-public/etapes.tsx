'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Les trois libellés portent l'étape : le même pas-à-pas sert la saisie et l'appel. */
export const ETAPES_SAISIE: readonly string[] = ['Identité', 'Situation', 'Revenus'];

export const ETAPES_APPEL: readonly string[] = ['Joignable', 'Dossier', 'Issue'];

export function EtapesProgression({
  etapes,
  courante,
  onChoisir,
}: {
  etapes: readonly string[];
  courante: number;
  onChoisir: (etape: number) => void;
}) {
  return (
    <nav aria-label="Progression du formulaire">
      <p className="sr-only">
        Étape {courante + 1} sur {etapes.length} : {etapes[courante]}
      </p>
      <ol className="flex flex-wrap items-center gap-2">
        {etapes.map((libelle, rang) => {
          const active = rang === courante;
          return (
            <li key={libelle} className="flex items-center gap-2">
              {rang > 0 ? (
                <span aria-hidden="true" className="text-muted-foreground">
                  ·
                </span>
              ) : null}
              <button
                type="button"
                aria-current={active ? 'step' : undefined}
                onClick={() => {
                  onChoisir(rang);
                }}
                className={cn(
                  'flex min-h-11 items-center gap-2 rounded-md border px-3 text-[0.875rem]',
                  active
                    ? 'border-primary bg-secondary font-[600] text-secondary-foreground'
                    : 'border-border text-muted-foreground hover:bg-secondary/60',
                )}
              >
                <span
                  className={cn(
                    'flex size-6 items-center justify-center rounded-full text-[0.75rem] tabular-nums',
                    active ? 'bg-primary text-primary-foreground' : 'bg-muted',
                  )}
                >
                  {rang + 1}
                </span>
                {libelle}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Retour et Continuer : la validation reste souple, l'envoi final tranche. */
export function PiedEtapes({
  courante,
  total,
  desactive,
  onRetour,
  onSuite,
}: {
  courante: number;
  total: number;
  desactive: boolean;
  onRetour: () => void;
  onSuite: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {courante > 0 ? (
        <Button type="button" variant="outline" disabled={desactive} onClick={onRetour}>
          Retour
        </Button>
      ) : (
        <span />
      )}
      {courante < total - 1 ? (
        <Button type="button" disabled={desactive} onClick={onSuite}>
          Continuer
        </Button>
      ) : null}
    </div>
  );
}
