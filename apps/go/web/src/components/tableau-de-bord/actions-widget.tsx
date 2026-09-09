import type { useSortable } from '@dnd-kit/sortable';
import { ArrowDownIcon, ArrowUpIcon, GripVerticalIcon, PaletteIcon, XIcon } from 'lucide-react';

import { ChoixGraphique } from '@/components/tableau-de-bord/chart-visual';
import type { MarqueEvaluee } from '@/components/tableau-de-bord/recommandation';
import { ReglagesPopover, reglagesVisibles } from '@/components/tableau-de-bord/reglages-widget';
import type {
  Marque,
  Presentation,
  ReglagesHonores,
  Taille,
} from '@/components/tableau-de-bord/sources';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type Sortable = ReturnType<typeof useSortable>;

/** La poignée de glissement : dnd-kit fournit ses attributs, ses écouteurs et son ancrage. */
export interface Poignee {
  attributs: Sortable['attributes'];
  ecouteurs: Sortable['listeners'];
  ancrer: Sortable['setActivatorNodeRef'];
}

export interface ActionsWidgetProps {
  titre: string;
  widgetId: string;
  marque: Marque | undefined;
  taille: Taille;
  peutMonter: boolean;
  peutDescendre: boolean;
  evaluees: readonly MarqueEvaluee[];
  honores: ReglagesHonores;
  triPertinent: boolean;
  presentation: Presentation;
  poignee: Poignee;
  onRetirer: () => void;
  onMonter: () => void;
  onDescendre: () => void;
  onMarque: (marque: Marque) => void;
  onTaille: (taille: Taille | undefined) => void;
  onPresentation: (presentation: Presentation) => void;
}

export function ActionsWidget({
  titre,
  widgetId,
  marque,
  taille,
  peutMonter,
  peutDescendre,
  evaluees,
  honores,
  triPertinent,
  presentation,
  poignee: { attributs, ecouteurs, ancrer },
  onRetirer,
  onMonter,
  onDescendre,
  onMarque,
  onTaille,
  onPresentation,
}: ActionsWidgetProps) {
  const pleine = taille === 'pleine';

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        ref={ancrer}
        type="button"
        aria-label={`Réordonner ${titre} par glisser-déposer`}
        className="inline-flex size-9 touch-manipulation items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
        {...attributs}
        {...ecouteurs}
      >
        <GripVerticalIcon className="size-4" aria-hidden="true" />
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Monter ${titre}`}
        disabled={!peutMonter}
        onClick={onMonter}
      >
        <ArrowUpIcon aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Descendre ${titre}`}
        disabled={!peutDescendre}
        onClick={onDescendre}
      >
        <ArrowDownIcon aria-hidden="true" />
      </Button>

      {evaluees.length > 1 ? (
        <Popover>
          <PopoverTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Changer la présentation de ${titre}`}
              />
            }
          >
            <PaletteIcon aria-hidden="true" />
          </PopoverTrigger>
          <PopoverContent
            className="flex max-h-[70vh] w-80 flex-col gap-1 overflow-y-auto p-2"
            align="end"
          >
            {evaluees.map((evaluee) => (
              <ChoixGraphique
                key={evaluee.marque}
                marque={evaluee.marque}
                conseille={evaluee.recommandee}
                raison={evaluee.raison}
                selectionne={evaluee.marque === marque}
                onSelect={() => {
                  onMarque(evaluee.marque);
                }}
              />
            ))}
          </PopoverContent>
        </Popover>
      ) : null}

      {reglagesVisibles(honores, triPertinent) ? (
        <ReglagesPopover
          titre={titre}
          widgetId={widgetId}
          honores={honores}
          triPertinent={triPertinent}
          presentation={presentation}
          onChange={onPresentation}
        />
      ) : null}

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`${pleine ? 'Réduire' : 'Agrandir'} ${titre}`}
        onClick={() => {
          onTaille(pleine ? undefined : 'pleine');
        }}
      >
        <span className="text-[0.6875rem] font-[700]">{pleine ? '½' : '⬜'}</span>
      </Button>

      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Retirer ${titre}`}
        onClick={onRetirer}
      >
        <XIcon aria-hidden="true" />
      </Button>
    </div>
  );
}
