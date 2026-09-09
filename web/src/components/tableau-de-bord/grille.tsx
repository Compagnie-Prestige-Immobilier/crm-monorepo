import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type Announcements,
  type DragEndEvent,
  type DragStartEvent,
  type ScreenReaderInstructions,
} from '@dnd-kit/core';
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import { CarteWidget } from '@/components/tableau-de-bord/carte-widget';
import { rendreMarque } from '@/components/tableau-de-bord/rendu-marque';
import type {
  Catalogue,
  Donnees,
  Marque,
  Presentation,
  Taille,
} from '@/components/tableau-de-bord/sources';
import { Card } from '@/components/ui/card';
import type { Widget } from '@/lib/data/disposition';

/** dnd-kit ne traduit rien par défaut : ces textes seraient lus en anglais. */
const INSTRUCTIONS: ScreenReaderInstructions = {
  draggable:
    'Pour déplacer ce graphique, appuyez sur la barre d’espace ou sur Entrée. ' +
    'Utilisez les flèches pour le repositionner, la barre d’espace pour le déposer, ' +
    'ou Échap pour annuler.',
};

function annonces(titreDe: (id: string) => string): Announcements {
  return {
    onDragStart: ({ active }) => `${titreDe(String(active.id))} saisi.`,
    onDragOver: ({ active, over }) =>
      over === null
        ? `${titreDe(String(active.id))} n’est plus au-dessus d’un emplacement.`
        : `${titreDe(String(active.id))} déplacé au-dessus de ${titreDe(String(over.id))}.`,
    onDragEnd: ({ active, over }) =>
      over === null
        ? `${titreDe(String(active.id))} déposé, position inchangée.`
        : `${titreDe(String(active.id))} déposé à la place de ${titreDe(String(over.id))}.`,
    onDragCancel: ({ active }) => `Déplacement de ${titreDe(String(active.id))} annulé.`,
  };
}

const CLASSE_GRILLE = 'grid grid-flow-dense gap-4 sm:grid-cols-2 xl:grid-cols-4';

export function GrilleWidgets({
  widgets,
  donnees,
  edition,
  catalogue,
  messageVide = 'Aucune donnée sur la période.',
  onReordonner,
  onRetirer,
  onDecaler,
  onMarque,
  onTaille,
  onPresentation,
}: {
  widgets: readonly Widget[];
  donnees: Map<string, Donnees>;
  edition: boolean;
  catalogue: Catalogue;
  messageVide?: string;
  onReordonner: (deId: string, versId: string) => void;
  onRetirer: (id: string) => void;
  onDecaler: (id: string, sens: -1 | 1) => void;
  onMarque: (id: string, marque: Marque) => void;
  onTaille: (id: string, taille: Taille | undefined) => void;
  onPresentation: (id: string, presentation: Presentation) => void;
}) {
  // Souris et tactile séparés : un capteur unique prend le `pointerdown` du
  // doigt avant tout `touchstart`, et le glissement partirait au premier pixel
  // de défilement de la tablette.
  const capteurs = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [actifId, setActifId] = useState<string | null>(null);
  const navigate = useNavigate();

  const titreDe = (id: string): string => {
    const widget = widgets.find((candidat) => candidat.id === id);
    if (widget === undefined) return '';
    return catalogue[widget.source]?.label ?? widget.source;
  };

  const cartes = widgets.map((widget, index) => {
    const donnee = donnees.get(widget.id);
    const lien = catalogue[widget.source]?.lien;
    return (
      <CarteWidget
        key={widget.id}
        widget={widget}
        donnees={donnee}
        edition={edition}
        catalogue={catalogue}
        peutMonter={index > 0}
        peutDescendre={index < widgets.length - 1}
        onRetirer={() => {
          onRetirer(widget.id);
        }}
        onMonter={() => {
          onDecaler(widget.id, -1);
        }}
        onDescendre={() => {
          onDecaler(widget.id, 1);
        }}
        onMarque={(marque) => {
          onMarque(widget.id, marque);
        }}
        onTaille={(taille) => {
          onTaille(widget.id, taille);
        }}
        onPresentation={(presentation) => {
          onPresentation(widget.id, presentation);
        }}
      >
        {donnee === undefined
          ? null
          : rendreMarque({
              source: widget.source,
              marque: widget.marque,
              donnees: donnee,
              presentation: widget.presentation,
              catalogue,
              messageVide,
              ouvrir:
                lien === undefined
                  ? undefined
                  : (id) => {
                      void navigate({ href: lien(id) });
                    },
            })}
      </CarteWidget>
    );
  });

  if (!edition) return <div className={CLASSE_GRILLE}>{cartes}</div>;

  return (
    <DndContext
      sensors={capteurs}
      collisionDetection={closestCenter}
      accessibility={{ announcements: annonces(titreDe), screenReaderInstructions: INSTRUCTIONS }}
      onDragStart={(evenement: DragStartEvent) => {
        setActifId(String(evenement.active.id));
      }}
      onDragEnd={(evenement: DragEndEvent) => {
        setActifId(null);
        const { active, over } = evenement;
        if (over === null || active.id === over.id) return;
        onReordonner(String(active.id), String(over.id));
      }}
      onDragCancel={() => {
        setActifId(null);
      }}
    >
      <SortableContext items={widgets.map((widget) => widget.id)} strategy={rectSortingStrategy}>
        <div className={CLASSE_GRILLE}>{cartes}</div>
      </SortableContext>
      {/* Aperçu sans canevas : déplacer une carte portant un graphique vivant
          déclenche la boucle de redimensionnement de Chart.js. */}
      <DragOverlay>
        {actifId === null ? null : (
          <Card className="animate-rise p-4 shadow-elev-xl">
            <p className="font-display text-[0.9375rem] font-[700]">{titreDe(actifId)}</p>
          </Card>
        )}
      </DragOverlay>
    </DndContext>
  );
}
