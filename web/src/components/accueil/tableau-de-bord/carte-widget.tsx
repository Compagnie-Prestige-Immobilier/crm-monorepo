'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVerticalIcon, Maximize2Icon, Minimize2Icon, XIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import {
  donneesVides,
  spanClass,
  type CatalogueEntree,
  type DashboardMarque,
  type DashboardTaille,
  type DonneesSource,
  type Forme,
} from '@/components/accueil/tableau-de-bord/sources';
import { ChartCard } from '@/components/dashboard/chart-card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DashboardWidget } from '@/lib/data/disposition';

/** Une tuile sans graphique n'a pas besoin de la zone réservée au diagramme. */
function hauteurDe(
  forme: Forme,
  marque: DashboardMarque | undefined,
  taille: DashboardTaille,
  vide: boolean,
): 'compacte' | 'normale' | 'haute' | 'libre' {
  if (vide) return 'compacte';
  if (forme === 'composition' && (marque === 'camembert' || marque === 'anneau')) return 'libre';
  if (taille === 'pleine' || forme === 'equipe') return 'haute';
  if (marque === 'tuile') return 'compacte';
  return 'normale';
}

function ActionsWidget({
  titre,
  taille,
  attributes,
  listeners,
  setActivatorNodeRef,
  onRemove,
  onChangeTaille,
}: {
  titre: string;
  taille: DashboardTaille;
  attributes: ReturnType<typeof useSortable>['attributes'];
  listeners: ReturnType<typeof useSortable>['listeners'];
  setActivatorNodeRef: ReturnType<typeof useSortable>['setActivatorNodeRef'];
  onRemove: () => void;
  onChangeTaille: (taille: DashboardTaille | undefined) => void;
}) {
  const pleine = taille === 'pleine';
  const Icone = pleine ? Minimize2Icon : Maximize2Icon;
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Déplacer ${titre}`}
        className="inline-flex size-9 cursor-grab touch-manipulation items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="size-4" aria-hidden="true" />
      </button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`${pleine ? 'Réduire' : 'Agrandir'} ${titre}`}
        onClick={() => {
          onChangeTaille(pleine ? undefined : 'pleine');
        }}
      >
        <Icone aria-hidden="true" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Retirer ${titre}`}
        onClick={onRemove}
      >
        <XIcon aria-hidden="true" />
      </Button>
    </div>
  );
}

export function CarteWidget({
  widget,
  entree,
  donnees,
  editable,
  onRemove,
  onChangeTaille,
  children,
}: {
  widget: DashboardWidget;
  entree: CatalogueEntree;
  donnees: DonneesSource | undefined;
  editable: boolean;
  onRemove: () => void;
  onChangeTaille: (taille: DashboardTaille | undefined) => void;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id, disabled: !editable });
  const vide = donnees === undefined ? false : donneesVides(donnees);
  const taille: DashboardTaille = widget.taille ?? 'demi';

  // `min-w-0` : sans lui, un tableau large élargit la colonne de grille et toute la page défile.
  return (
    <div
      id={`widget-${widget.id}`}
      ref={setNodeRef}
      tabIndex={-1}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        viewTransitionName: `carte-${widget.id}`,
      }}
      className={cn('min-w-0', spanClass(widget.marque, widget.taille), isDragging && 'opacity-40')}
    >
      <ChartCard
        title={entree.label}
        info={entree.description}
        hauteur={hauteurDe(entree.forme, widget.marque, taille, vide)}
        actions={
          editable ? (
            <ActionsWidget
              titre={entree.label}
              taille={taille}
              attributes={attributes}
              listeners={listeners}
              setActivatorNodeRef={setActivatorNodeRef}
              onRemove={onRemove}
              onChangeTaille={onChangeTaille}
            />
          ) : undefined
        }
      >
        {isDragging ? null : children}
      </ChartCard>
    </div>
  );
}
