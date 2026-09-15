'use client';

import { Kbd } from '@/components/console/console-ui';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const REVELE = 'animate-in fade-in-0 slide-in-from-top-1 duration-200 motion-reduce:animate-none';

export const AUCUN_MOTIF =
  'Aucun motif réglé pour ce cas. Demandez à l’administrateur d’en ajouter dans les listes de référence.';

export interface Choix {
  readonly cle: string;
  readonly label: string;
  /** Ce que ce choix entraîne, en trois mots sous le libellé. */
  readonly aide?: string;
  readonly actif: boolean;
  readonly choisir: () => void;
}

/** Un palier de la qualification : une question, ses réponses, la réponse retenue en surbrillance. */
export function Palier({
  question,
  choix,
  raccourcis,
  vide,
  disabled,
}: {
  question: string;
  choix: readonly Choix[];
  /** Les chiffres ne visent qu'un palier à la fois : le dernier ouvert. */
  raccourcis: boolean;
  vide: string;
  disabled: boolean;
}) {
  return (
    <fieldset className={cn('flex flex-col gap-3', REVELE)} disabled={disabled}>
      <legend className="pb-1 font-display text-[1.0625rem] font-[700]">{question}</legend>
      {choix.length === 0 ? (
        <p role="alert" className="text-[0.875rem] text-warning">
          {vide}
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {choix.map((item, rang) => (
            <Button
              key={item.cle}
              variant={item.actif ? 'default' : 'outline'}
              aria-pressed={item.actif}
              onClick={item.choisir}
              className="h-auto min-h-12 justify-start px-3 py-2 text-left"
            >
              {raccourcis && rang < 9 ? <Kbd>{String(rang + 1)}</Kbd> : null}
              <span className="flex flex-col">
                <span>{item.label}</span>
                {item.aide === undefined ? null : (
                  <span
                    className={cn(
                      'text-[0.75rem] font-[400]',
                      item.actif ? 'text-primary-foreground/80' : 'text-muted-foreground',
                    )}
                  >
                    {item.aide}
                  </span>
                )}
              </span>
            </Button>
          ))}
        </div>
      )}
    </fieldset>
  );
}

/**
 * Le statut, puis sa précision quand il en porte (docs/decisions/codification-leads.md).
 * Chaque palier franchi reste visible et se change d'un clic.
 */
export function PaliersStatut({
  joignable,
  statuts,
  precisions,
  raccourcis,
  disabled,
}: {
  joignable: boolean;
  statuts: readonly Choix[];
  /** Vide tant que le statut retenu n'a pas de sous-catégorie. */
  precisions: readonly Choix[];
  raccourcis: boolean;
  disabled: boolean;
}) {
  return (
    <>
      <Palier
        question={
          joignable ? 'Quel statut de qualification ?' : 'Pourquoi n’a-t-elle pas répondu ?'
        }
        choix={statuts}
        raccourcis={raccourcis && precisions.length === 0}
        vide={AUCUN_MOTIF}
        disabled={disabled}
      />
      {precisions.length === 0 ? null : (
        <Palier
          question="Quelle précision ?"
          choix={precisions}
          raccourcis={raccourcis}
          vide={AUCUN_MOTIF}
          disabled={disabled}
        />
      )}
    </>
  );
}
