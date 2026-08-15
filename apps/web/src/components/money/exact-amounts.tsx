'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { formatXof, formatXofCompact } from '@/lib/money';
import { cn } from '@/lib/utils';

/**
 * Montants abrégés ou exacts : le basculement vaut pour TOUT l'écran.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * Abréger sans donner accès au nombre exact, c'est cacher la donnée.
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `1 250 000 000 FCFA` déborde d'une tuile d'indicateur : l'abrégé est
 * nécessaire. Mais un directeur financier qui lit « 1,25 Mrd » doit pouvoir
 * obtenir « 1 250 000 000 » sans quitter la page ni ouvrir un export : sinon
 * l'écran de pilotage cesse d'être une source et redevient une vitrine.
 *
 * Trois voies vers le chiffre exact, et il en faut trois :
 *
 *  1. l'info-bulle native (`title`), pour la souris ;
 *  2. un interrupteur « Chiffres exacts » qui bascule l'écran entier, pour le
 *     tactile, le clavier, et surtout pour la lecture prolongée : vérifier
 *     douze montants un par un au survol est intenable ;
 *  3. le texte accessible, qui porte TOUJOURS le montant exact : un abrégé
 *     annoncé « un virgule vingt-cinq milliard » à un lecteur d'écran serait
 *     la seule version disponible pour qui ne voit pas l'info-bulle.
 *
 * Le contexte vaut `false` hors fournisseur : un montant rendu ailleurs
 * s'affiche abrégé, jamais cassé.
 */
const ExactAmountsContext = createContext<{
  exact: boolean;
  toggle: () => void;
}>({ exact: false, toggle: () => undefined });

const STORAGE_KEY = 'cpi.montants-exacts';

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function ExactAmountsProvider({ children }: { children: ReactNode }) {
  /**
   * `false` au premier rendu, des deux côtés.
   *
   * Lire `localStorage` dans l'initialisation produirait un arbre serveur et un
   * arbre client différents, donc une erreur d'hydratation. La préférence est
   * appliquée juste après le montage.
   */
  const [exact, setExact] = useState(false);

  useEffect(() => {
    setExact(readStored());
  }, []);

  const toggle = useCallback(() => {
    setExact((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        // Préférence perdue, écran intact : rien à signaler à l'utilisateur.
      }
      return next;
    });
  }, []);

  const value = useMemo(() => ({ exact, toggle }), [exact, toggle]);

  return <ExactAmountsContext.Provider value={value}>{children}</ExactAmountsContext.Provider>;
}

export function useExactAmounts(): { exact: boolean; toggle: () => void } {
  return useContext(ExactAmountsContext);
}

/**
 * Un montant XOF.
 *
 * Abrégé par défaut, exact quand l'écran le demande. Le nombre exact est de
 * toute façon dans le DOM, en `title` et pour le lecteur d'écran : il n'existe
 * aucun état où la valeur réelle serait inatteignable.
 *
 * `tabular-nums` et alignement à droite ne sont pas décoratifs : sans chiffres
 * de largeur fixe, une colonne de montants danse d'une ligne à l'autre et
 * devient illisible dès la troisième ligne.
 */
export function MoneyText({
  value,
  placeholder = '–',
  className,
}: {
  value: string | null | undefined;
  placeholder?: string | undefined;
  className?: string | undefined;
}) {
  const { exact } = useExactAmounts();
  const full = formatXof(value, placeholder);
  const compact = formatXofCompact(value, placeholder);
  const shown = exact ? full : compact;

  // Rien à révéler quand l'abrégé EST le montant exact : une info-bulle qui
  // répète le texte visible est un bruit que l'utilisateur apprend à ignorer,
  // y compris là où elle porte vraiment quelque chose.
  const abbreviated = compact !== full;

  return (
    <span className={cn('tabular-nums', className)} title={abbreviated ? full : undefined}>
      <span aria-hidden={abbreviated ? 'true' : undefined}>{shown}</span>
      {abbreviated ? <span className="sr-only">{full}</span> : null}
    </span>
  );
}

/**
 * L'interrupteur « Chiffres exacts ».
 *
 * Un `switch` et non une case à cocher : l'état s'applique immédiatement à
 * l'écran entier, sans validation. `aria-pressed` porte l'état pour le clavier
 * et le lecteur d'écran.
 */
export function ExactAmountsToggle({ className }: { className?: string | undefined }) {
  const { exact, toggle } = useExactAmounts();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={exact}
      className={cn(
        'inline-flex h-9 items-center gap-2 rounded-md border border-border px-3',
        'text-[0.75rem] font-[600] transition-colors duration-(--dur-1) ease-(--ease-out-cpi)',
        'hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        exact ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'relative h-4 w-7 shrink-0 rounded-full transition-colors duration-(--dur-1)',
          exact ? 'bg-primary' : 'bg-switch-background',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 size-3 rounded-full bg-primary-foreground transition-[left] duration-(--dur-1) ease-(--ease-out-cpi)',
            exact ? 'left-3.5' : 'left-0.5',
          )}
        />
      </span>
      Chiffres exacts
    </button>
  );
}
