'use client';

import { CheckIcon } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Les trois libellés portent l'étape : le même pas-à-pas sert la saisie et l'appel. */
export const ETAPES_SAISIE: readonly string[] = ['Identité', 'Situation', 'Revenus'];

export const ETAPES_APPEL: readonly string[] = ['Joignable', 'Dossier', 'Issue'];

type EtatEtape = 'faite' | 'active' | 'a_venir';

const etatDe = (rang: number, courante: number): EtatEtape => {
  if (rang < courante) return 'faite';
  return rang === courante ? 'active' : 'a_venir';
};

const CLASSE_LIBELLE: Readonly<Record<EtatEtape, string>> = {
  faite: 'text-foreground',
  active: 'text-primary',
  a_venir: 'text-muted-foreground',
};

const CLASSE_PASTILLE: Readonly<Record<EtatEtape, string>> = {
  faite: 'border-primary bg-primary text-primary-foreground',
  active: 'border-primary text-primary',
  a_venir: 'border-border text-muted-foreground',
};

/** Les étapes en pastilles reliées : faites cochées, l'active en couleur, la suite grisée. */
export function EtapesProgression({
  etapes,
  courante,
  maximum = etapes.length - 1,
  onChoisir,
}: {
  etapes: readonly string[];
  courante: number;
  maximum?: number;
  onChoisir: (etape: number) => void;
}) {
  const barre = useRef<HTMLElement>(null);

  // Sur téléphone, la rangée déborde : l'étape en cours se ramène dans le cadre.
  useEffect(() => {
    barre.current
      ?.querySelector('[aria-current="step"]')
      ?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [courante]);

  return (
    <nav ref={barre} aria-label="Progression du formulaire" className="overflow-x-auto">
      <p className="sr-only">
        Étape {courante + 1} sur {etapes.length} : {etapes[courante]}
      </p>
      <ol className="flex items-end">
        {etapes.map((libelle, rang) => {
          const etat = etatDe(rang, courante);
          return (
            <li key={libelle} className="flex items-end">
              <button
                type="button"
                disabled={rang > maximum}
                aria-current={etat === 'active' ? 'step' : undefined}
                onClick={() => {
                  onChoisir(rang);
                }}
                className="flex flex-col items-center gap-1 rounded-md px-1 disabled:cursor-not-allowed"
              >
                <span
                  className={cn(
                    'text-[0.75rem] font-[600] whitespace-nowrap',
                    CLASSE_LIBELLE[etat],
                    etat === 'active' ? '' : 'hidden sm:inline',
                  )}
                >
                  {libelle}
                </span>
                <span
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full border-2 text-[0.75rem] font-[600] tabular-nums',
                    CLASSE_PASTILLE[etat],
                  )}
                >
                  {etat === 'faite' ? (
                    <CheckIcon className="size-4" aria-hidden="true" />
                  ) : (
                    rang + 1
                  )}
                </span>
              </button>
              {rang < etapes.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    'mb-[13px] h-0.5 w-5 sm:w-12',
                    etat === 'faite' ? 'bg-primary' : 'bg-border',
                  )}
                />
              ) : null}
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
  suiteDesactive = false,
  onRetour,
  onSuite,
}: {
  courante: number;
  total: number;
  desactive: boolean;
  suiteDesactive?: boolean;
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
        <Button type="button" disabled={desactive || suiteDesactive} onClick={onSuite}>
          Continuer
        </Button>
      ) : null}
    </div>
  );
}
