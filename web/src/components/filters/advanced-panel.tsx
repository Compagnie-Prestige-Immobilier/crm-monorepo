'use client';

import { ChevronDownIcon, SlidersHorizontalIcon, XIcon } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { advancedOpenFrom } from '@/lib/filters';
import { cn } from '@/lib/utils';

export interface AdvancedChipItem<K extends string> {
  key: K;
  field: string;
  value: string;
}

const PASTILLE =
  'inline-flex h-8 max-w-full items-center gap-1.5 rounded-full border border-border pr-1.5 pl-2.5 text-[0.75rem] transition-colors duration-(--dur-1) ease-(--ease-out-cpi) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

function storageKey(module: string): string {
  return `cpi.filtres-avances.${module}`;
}

function readStoredOpen(module: string): boolean | null {
  try {
    const raw = window.localStorage.getItem(storageKey(module));
    return raw === null ? null : raw === '1';
  } catch {
    return null;
  }
}

function writeStoredOpen(module: string, open: boolean): void {
  try {
    window.localStorage.setItem(storageKey(module), open ? '1' : '0');
  } catch {}
}

export function AdvancedPanel<K extends string>({
  module,
  chips,
  onRemove,
  onClearAll,
  actions,
  startCollapsed = false,
  children,
}: {
  module: string;
  chips: readonly AdvancedChipItem<K>[];
  onRemove: (key: K) => void;
  onClearAll: () => void;
  actions?: ReactNode | undefined;
  /**
   * Replié même quand un critère est actif. Réservé aux écrans où le filtre
   * vient d'un LIEN et non d'une intention : ouvrir douze listes déroulantes
   * devant quelqu'un qui a simplement cliqué « voir les prospects en attente »
   * lui montre l'outillage au lieu du résultat. Les critères actifs restent
   * lisibles : le rappel en pastilles ci-dessous ne s'affiche QUE fermé.
   */
  startCollapsed?: boolean;
  children: ReactNode;
}) {
  const panelId = useId();
  const count = chips.length;

  const [open, setOpen] = useState(() => !startCollapsed && count > 0);
  const preferenceApplied = useRef(false);

  useEffect(() => {
    if (preferenceApplied.current) return;
    preferenceApplied.current = true;
    setOpen(advancedOpenFrom(!startCollapsed && count > 0, readStoredOpen(module)));
  }, [count, module, startCollapsed]);

  const toggle = useCallback(() => {
    setOpen((current) => {
      writeStoredOpen(module, !current);
      return !current;
    });
  }, [module]);

  const rappel = !open && count > 0;
  const pluriel = count > 1 ? 's' : '';

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={panelId}
        >
          <SlidersHorizontalIcon aria-hidden="true" />
          Filtres avancés
          {/* Le compte porte sur les critères REPLIÉS, et sur eux seuls : ce
              sont les seuls qu'on ne voit pas. Compter aussi la recherche et la
              période mettrait un « 5 » sur un bouton qui n'en cache que trois. */}
          {count > 0 ? (
            <Badge variant="default" className="tabular-nums">
              {count}
              <span className="sr-only">
                {' '}
                critère{pluriel} replié{pluriel}
              </span>
            </Badge>
          ) : null}
          <ChevronDownIcon
            aria-hidden="true"
            className={cn(
              'transition-transform duration-(--dur-1) ease-(--ease-out-cpi)',
              open && 'rotate-180',
            )}
          />
        </Button>

        {/* Rappel affiché UNIQUEMENT panneau fermé : ouvert, chaque champ porte
            déjà sa valeur. */}
        {rappel
          ? chips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => {
                  onRemove(chip.key);
                }}
                aria-label={`Retirer le filtre ${chip.field} : ${chip.value}`}
                className={cn(PASTILLE, 'bg-secondary text-secondary-foreground hover:bg-muted')}
              >
                <span className="truncate">
                  <span className="text-muted-foreground">{chip.field} : </span>
                  <span className="font-[600]">{chip.value}</span>
                </span>
                <XIcon className="size-3.5 shrink-0" aria-hidden="true" />
              </button>
            ))
          : null}
        {/* Même forme que les pastilles : l'action porte sur elles, pas sur la
            recherche ni la période, que « Tout effacer » emporte, lui. */}
        {rappel ? (
          <button
            type="button"
            onClick={onClearAll}
            className={cn(
              PASTILLE,
              'border-dashed text-muted-foreground hover:bg-secondary hover:text-foreground',
            )}
          >
            Tout retirer
            <XIcon className="size-3.5 shrink-0" aria-hidden="true" />
          </button>
        ) : null}

        {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
      </div>

      {/* Champs repliés retirés du DOM plutôt que masqués en CSS. La hauteur est
          bornée : douze listes dépliées poussaient le tableau hors de l'écran,
          sur téléphone comme sur poste. */}
      <div
        id={panelId}
        hidden={!open}
        className="grid max-h-[min(24rem,45svh)] gap-x-4 gap-y-3 overflow-y-auto rounded-md border border-border bg-secondary p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 [&_[data-slot=label]]:text-[0.8125rem] [&_[data-slot=label]]:text-muted-foreground"
      >
        {open ? children : null}
      </div>
    </div>
  );
}
